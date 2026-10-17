"""Generate a seamless, softly filtered wind loop using only the Python standard library."""
import cmath
import math
from pathlib import Path
import random
import struct
import wave

RATE = 44100
COUNT = 131072
rng = random.Random(917)
spectrum = [0j] * COUNT
# Random phases produce air noise without pitched or bubbling oscillators.
for k in range(1, COUNT // 2):
    frequency = k * RATE / COUNT
    highpass = 1 - math.exp(-(frequency / 200) ** 4)
    lowpass = math.exp(-(frequency / 2400) ** 2)
    amplitude = highpass * lowpass / math.sqrt(max(frequency, 200))
    value = cmath.rect(amplitude * rng.uniform(0.5, 1.5), rng.random() * math.tau)
    spectrum[k] = value
    spectrum[-k] = value.conjugate()

# Inverse FFT. Periodic synthesis keeps the waveform continuous at the loop boundary.
j = 0
for i in range(1, COUNT):
    bit = COUNT >> 1
    while j & bit:
        j ^= bit
        bit >>= 1
    j ^= bit
    if i < j:
        spectrum[i], spectrum[j] = spectrum[j], spectrum[i]
size = 2
while size <= COUNT:
    step = cmath.exp(2j * math.pi / size)
    for start in range(0, COUNT, size):
        phase = 1 + 0j
        for offset in range(size // 2):
            a = start + offset
            b = a + size // 2
            even, odd = spectrum[a], spectrum[b] * phase
            spectrum[a], spectrum[b] = even + odd, even - odd
            phase *= step
    size *= 2

# Gentle periodic gusts add breath without a pronounced pulse.
samples = [value.real * (0.9 + 0.07 * math.sin(math.tau * i / COUNT)
           + 0.03 * math.sin(2 * math.tau * i / COUNT + 0.7))
           for i, value in enumerate(spectrum)]
rms = math.sqrt(sum(value * value for value in samples) / COUNT)
scale = min(0.12 / rms, 0.65 / max(abs(value) for value in samples))
output = Path(__file__).resolve().parents[1] / 'public/sounds/bubble-inflate.wav'
with wave.open(str(output), 'wb') as wav:
    wav.setparams((1, 2, RATE, COUNT, 'NONE', 'not compressed'))
    wav.writeframes(b''.join(struct.pack('<h', round(value * scale * 32767)) for value in samples))
print(f'Generated {output.name}: {COUNT / RATE:.2f}s, mono PCM, {RATE} Hz')
