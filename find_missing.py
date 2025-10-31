#!/usr/bin/env python3
import pdfplumber
import re

def clean_text(text):
    if not text:
        return ''
    return text.replace('\x00', ' ').strip()

pdf_path = 'reportes_csv/intek-medical-final.pdf'
with pdfplumber.open(pdf_path) as pdf:
    text_lines = []
    for page in pdf.pages:
        page_text = page.extract_text()
        if page_text:
            text_lines.extend(page_text.split('\n'))

# Find all duration patterns
all_durations = []
for i, line in enumerate(text_lines):
    clean_line = clean_text(line)
    # Skip the header total line
    if i < 10 and '483:31:35' in clean_line:
        continue
    dur_matches = re.finditer(r'(\d+):(\d{2}):(\d{2})', clean_line)
    for match in dur_matches:
        all_durations.append((i, clean_line, match.groups()))

print(f"Total duration patterns found: {len(all_durations)}")

# Current capture - durations with member in same line
captured = []
for i, line in enumerate(text_lines):
    clean_line = clean_text(line)
    if i < 10 and '483:31:35' in clean_line:
        continue
    dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', clean_line)
    if dur_match and any(member in clean_line for member in ['Dani', 'Alberto', 'Joan', 'Jordi']):
        captured.append((i, clean_line, dur_match.groups()))

print(f"Currently captured: {len(captured)}")

# Find durations NOT in our capture
missing = []
for dur_line in all_durations:
    if dur_line not in captured:
        # Check if there's a member nearby (within 2 lines)
        line_idx = dur_line[0]
        has_member_nearby = False
        for j in range(max(0, line_idx - 2), min(len(text_lines), line_idx + 3)):
            nearby = clean_text(text_lines[j])
            if any(member in nearby for member in ['Dani', 'Alberto', 'Joan', 'Jordi']):
                has_member_nearby = True
                break
        
        if has_member_nearby:
            missing.append(dur_line)

print(f"\nMissing durations (with member nearby): {len(missing)}")
if missing:
    print("\nFirst 10 missing entries:")
    for idx, (line_num, line, dur) in enumerate(missing[:10]):
        print(f"  {idx+1}. Line {line_num}: {line[:100]}")
        # Show context
        print(f"      Context:")
        for j in range(max(0, line_num - 2), min(len(text_lines), line_num + 3)):
            print(f"        {j}: {clean_text(text_lines[j])[:80]}")

# Calculate if missing entries add up to the difference
if missing:
    missing_seconds = sum(int(h)*3600 + int(m)*60 + int(s) for _, _, (h, m, s) in missing)
    expected_diff = 2597  # 0:43:17 in seconds
    print(f"\nMissing duration total: {missing_seconds} seconds ({missing_seconds // 3600}:{(missing_seconds % 3600) // 60:02d}:{missing_seconds % 60:02d})")
    print(f"Expected difference: {expected_diff} seconds")
    if abs(missing_seconds - expected_diff) < 10:
        print("✅ Missing entries match the expected difference!")

