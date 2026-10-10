
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX

#include <windows.h>
#include <shellapi.h>
#include <winsock2.h>
#include <ws2tcpip.h>

#include <atomic>
#include <filesystem>
#include <fstream>
#include <string>
#include <thread>
#include <algorithm>

#pragma comment(lib, "Ws2_32.lib")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "User32.lib")

namespace fs = std::filesystem;

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

constexpr unsigned short PORT = 8765;
constexpr UINT WM_TRAY = WM_APP + 1;

constexpr UINT ID_OPEN = 1001;
constexpr UINT ID_EXIT = 1002;

constexpr UINT TRAY_ID = 1;

constexpr wchar_t CLASS_NAME[] = L"BalloonsTrayWindow";

std::atomic_bool running = false;

SOCKET listener = INVALID_SOCKET;
std::thread serverThread;

NOTIFYICONDATAW tray = {};

fs::path webRoot;

// ------------------------------------------------------------
// HTTP utilities
// ------------------------------------------------------------

bool SendAll(
    SOCKET socket,
    const char* data,
    size_t length)
{
    while (length > 0)
    {
        int count = send(
            socket,
            data,
            static_cast<int>(
                std::min<size_t>(length, 65536)),
            0
        );

        if (count <= 0)
            return false;

        data += count;
        length -= count;
    }

    return true;
}

void SendResponse(
    SOCKET socket,
    int status,
    const char* message)
{
    std::string body = message;

    std::string header =
        "HTTP/1.1 " + std::to_string(status) +
        " " + message + "\r\n"
        "Content-Type: text/plain\r\n"
        "Content-Length: " +
        std::to_string(body.size()) + "\r\n"
        "Connection: close\r\n"
        "\r\n";

    SendAll(socket, header.data(), header.size());
    SendAll(socket, body.data(), body.size());
}

const char* GetMimeType(const fs::path& path)
{
    auto ext = path.extension().string();

    if (ext == ".html") return "text/html; charset=utf-8";
    if (ext == ".js") return "text/javascript; charset=utf-8";
    if (ext == ".css") return "text/css; charset=utf-8";
    if (ext == ".svg") return "image/svg+xml";
    if (ext == ".json") return "application/json";
    if (ext == ".png") return "image/png";
    if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
    if (ext == ".webp") return "image/webp";
    if (ext == ".ico") return "image/x-icon";
    if (ext == ".woff2") return "font/woff2";
    if (ext == ".wasm") return "application/wasm";

    return "application/octet-stream";
}

// ------------------------------------------------------------
// Static file server
// ------------------------------------------------------------

void HandleClient(SOCKET client)
{
    DWORD timeout = 2000;

    setsockopt(
        client,
        SOL_SOCKET,
        SO_RCVTIMEO,
        reinterpret_cast<const char*>(&timeout),
        sizeof(timeout)
    );

    setsockopt(
        client,
        SOL_SOCKET,
        SO_SNDTIMEO,
        reinterpret_cast<const char*>(&timeout),
        sizeof(timeout)
    );

    char buffer[8192];
    std::string request;

    while (request.find("\r\n") == std::string::npos)
    {
        int received = recv(
            client,
            buffer,
            sizeof(buffer),
            0
        );

        if (received <= 0)
            return;

        request.append(buffer, received);

        if (request.size() > sizeof(buffer))
        {
            SendResponse(client, 400, "Bad Request");
            return;
        }
    }

    const auto lineEnd = request.find("\r\n");
    const std::string line = request.substr(0, lineEnd);

    if (line.compare(0, 4, "GET ") != 0)
    {
        SendResponse(client, 405, "Method Not Allowed");
        return;
    }

    const auto end = line.find(' ', 4);

    if (end == std::string::npos)
    {
        SendResponse(client, 400, "Bad Request");
        return;
    }

    std::string url = line.substr(4, end - 4);

    // Strip the query string.
    url = url.substr(0, url.find('?'));

    if (url == "/")
        url = "/index.html";

    // Accept only simple, relative URL paths.
    // Reject encoded paths and Windows separators.
    if (url.empty() ||
        url[0] != '/' ||
        url.find('%') != std::string::npos ||
        url.find('\\') != std::string::npos ||
        url.find(':') != std::string::npos)
    {
        SendResponse(client, 400, "Bad Request");
        return;
    }

    fs::path relative = fs::u8path(url.substr(1));

    for (const auto& part : relative)
    {
        if (part == ".." || part == ".")
        {
            SendResponse(client, 403, "Forbidden");
            return;
        }
    }

    fs::path file = webRoot / relative;

    std::error_code ec;

    if (!fs::is_regular_file(file, ec))
    {
        SendResponse(client, 404, "Not Found");
        return;
    }

    std::ifstream stream(file, std::ios::binary);

    if (!stream)
    {
        SendResponse(client, 500, "Internal Server Error");
        return;
    }

    auto size = fs::file_size(file, ec);

    if (ec)
    {
        SendResponse(client, 500, "Internal Server Error");
        return;
    }

    std::string header =
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: " +
        std::string(GetMimeType(file)) + "\r\n"
        "Content-Length: " +
        std::to_string(size) + "\r\n"
        "Cache-Control: no-cache\r\n"
        "X-Content-Type-Options: nosniff\r\n"
        "Connection: close\r\n"
        "\r\n";

    if (!SendAll(client, header.data(), header.size()))
        return;

    char chunk[65536];

    while (stream)
    {
        stream.read(chunk, sizeof(chunk));

        auto count = stream.gcount();

        if (count <= 0)
            break;

        if (!SendAll(client, chunk, static_cast<size_t>(count)))
            break;
    }
}

// ------------------------------------------------------------
// HTTP server lifecycle
// ------------------------------------------------------------

bool StartServer()
{
    listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);

    if (listener == INVALID_SOCKET)
        return false;

    sockaddr_in address = {};

    address.sin_family = AF_INET;
    address.sin_port = htons(PORT);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(
        listener,
        reinterpret_cast<sockaddr*>(&address),
        sizeof(address)) == SOCKET_ERROR)
    {
        closesocket(listener);
        listener = INVALID_SOCKET;
        return false;
    }

    if (listen(listener, SOMAXCONN) == SOCKET_ERROR)
    {
        closesocket(listener);
        listener = INVALID_SOCKET;
        return false;
    }

    running = true;

    serverThread = std::thread([]()
    {
        while (running)
        {
            SOCKET client = accept(
                listener,
                nullptr,
                nullptr
            );

            if (client == INVALID_SOCKET)
                break;

            if (running)
                HandleClient(client);

            closesocket(client);
        }
    });

    return true;
}

void StopServer()
{
    if (!running.exchange(false))
        return;

    // Wake the blocking accept() call.
    SOCKET wake = socket(
        AF_INET,
        SOCK_STREAM,
        IPPROTO_TCP
    );

    if (wake != INVALID_SOCKET)
    {
        sockaddr_in address = {};

        address.sin_family = AF_INET;
        address.sin_port = htons(PORT);
        address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

        connect(
            wake,
            reinterpret_cast<sockaddr*>(&address),
            sizeof(address)
        );

        closesocket(wake);
    }

    if (serverThread.joinable())
        serverThread.join();

    closesocket(listener);
    listener = INVALID_SOCKET;
}

// ------------------------------------------------------------
// Edge launcher
// ------------------------------------------------------------

void LaunchEdge(HWND owner)
{
    std::wstring arguments =
        L"--kiosk "
        L"http://127.0.0.1:8765 "
        L"--edge-kiosk-type=fullscreen "
        L"--no-first-run";

    auto result = reinterpret_cast<INT_PTR>(
        ShellExecuteW(
            owner,
            L"open",
            L"msedge.exe",
            arguments.c_str(),
            nullptr,
            SW_SHOWNORMAL
        )
    );

    if (result <= 32)
    {
        MessageBoxW(
            owner,
            L"Unable to launch Microsoft Edge.",
            L"Balloons",
            MB_OK | MB_ICONERROR
        );
    }
}

// ------------------------------------------------------------
// System tray
// ------------------------------------------------------------

void ShowTrayMenu(HWND hwnd)
{
    HMENU menu = CreatePopupMenu();

    AppendMenuW(
        menu,
        MF_STRING,
        ID_OPEN,
        L"Open Balloons"
    );

    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);

    AppendMenuW(
        menu,
        MF_STRING,
        ID_EXIT,
        L"Exit"
    );

    POINT point;
    GetCursorPos(&point);

    SetForegroundWindow(hwnd);

    TrackPopupMenu(
        menu,
        TPM_RIGHTBUTTON,
        point.x,
        point.y,
        0,
        hwnd,
        nullptr
    );

    PostMessageW(hwnd, WM_NULL, 0, 0);

    DestroyMenu(menu);
}

LRESULT CALLBACK WindowProc(
    HWND hwnd,
    UINT message,
    WPARAM wParam,
    LPARAM lParam)
{
    switch (message)
    {
        case WM_TRAY:
        {
            UINT event = LOWORD(lParam);

            if (event == WM_RBUTTONUP ||
                event == WM_CONTEXTMENU)
            {
                ShowTrayMenu(hwnd);
            }
            else if (event == WM_LBUTTONDBLCLK)
            {
                LaunchEdge(hwnd);
            }

            return 0;
        }

        case WM_COMMAND:
        {
            switch (LOWORD(wParam))
            {
                case ID_OPEN:
                    LaunchEdge(hwnd);
                    return 0;

                case ID_EXIT:
                    DestroyWindow(hwnd);
                    return 0;
            }

            break;
        }

        case WM_DESTROY:
        {
            Shell_NotifyIconW(NIM_DELETE, &tray);
            PostQuitMessage(0);
            return 0;
        }
    }

    return DefWindowProcW(
        hwnd,
        message,
        wParam,
        lParam
    );
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

int WINAPI wWinMain(
    HINSTANCE instance,
    HINSTANCE,
    PWSTR,
    int)
{
    wchar_t executable[MAX_PATH];

    GetModuleFileNameW(
        nullptr,
        executable,
        MAX_PATH
    );

    webRoot = fs::path(executable).parent_path() / L"dist";

    if (!fs::exists(webRoot / L"index.html"))
    {
        MessageBoxW(
            nullptr,
            L"dist\\index.html was not found.",
            L"Balloons",
            MB_OK | MB_ICONERROR
        );

        return 1;
    }

    WSADATA wsa = {};

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0)
        return 1;

    if (!StartServer())
    {
        MessageBoxW(
            nullptr,
            L"Unable to start the HTTP server on port 8765.",
            L"Balloons",
            MB_OK | MB_ICONERROR
        );

        WSACleanup();
        return 1;
    }

    WNDCLASSW wc = {};

    wc.lpfnWndProc = WindowProc;
    wc.hInstance = instance;
    wc.lpszClassName = CLASS_NAME;

    if (!RegisterClassW(&wc))
    {
        StopServer();
        WSACleanup();
        return 1;
    }

    HWND hwnd = CreateWindowExW(
        0,
        CLASS_NAME,
        L"Balloons",
        WS_OVERLAPPED,
        0, 0, 0, 0,
        nullptr,
        nullptr,
        instance,
        nullptr
    );

    if (!hwnd)
    {
        StopServer();
        WSACleanup();
        return 1;
    }

    tray.cbSize = sizeof(tray);
    tray.hWnd = hwnd;
    tray.uID = TRAY_ID;
    tray.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    tray.uCallbackMessage = WM_TRAY;
    tray.hIcon = LoadIconW(nullptr, IDI_APPLICATION);

    wcscpy_s(tray.szTip, L"Balloons");

    if (!Shell_NotifyIconW(NIM_ADD, &tray))
    {
        DestroyWindow(hwnd);
        StopServer();
        WSACleanup();
        return 1;
    }

    tray.uVersion = NOTIFYICON_VERSION_4;

    Shell_NotifyIconW(
        NIM_SETVERSION,
        &tray
    );

    LaunchEdge(hwnd);

    MSG message;

    while (GetMessageW(&message, nullptr, 0, 0) > 0)
    {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }

    StopServer();
    WSACleanup();

    return 0;
}
