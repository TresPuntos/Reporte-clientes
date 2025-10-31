#!/usr/bin/env python3
import csv
import re

csv_path = 'reportes_csv/intek_medical_final_data.csv'
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    entries = list(reader)

total_sec = 0
for e in entries:
    d = e['Duration (HH:MM:SS)']
    m = re.match(r'(\d+):(\d{2}):(\d{2})', d)
    if m:
        h, m_val, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        total_sec += h*3600 + m_val*60 + s

h = total_sec // 3600
m = (total_sec % 3600) // 60
s = total_sec % 60

print(f'Total from CSV: {h}:{m:02d}:{s:02d}')
print(f'Total entries: {len(entries)}')

# Expected total
expected_h, expected_m, expected_s = 483, 31, 35
expected_total = expected_h * 3600 + expected_m * 60 + expected_s
actual_total = total_sec
difference = expected_total - actual_total

diff_h = difference // 3600
diff_m = (difference % 3600) // 60
diff_s = difference % 60

print(f'\nExpected: {expected_h}:{expected_m:02d}:{expected_s:02d}')
print(f'Difference: {diff_h}:{diff_m:02d}:{diff_s:02d} ({difference} seconds)')

