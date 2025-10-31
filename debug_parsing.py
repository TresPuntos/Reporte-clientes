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

# Find all lines with duration and member
lines_with_dur_member = []
for i, line in enumerate(text_lines):
    clean_line = clean_text(line)
    dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', clean_line)
    if dur_match and any(member in clean_line for member in ['Dani', 'Alberto', 'Joan', 'Jordi']):
        lines_with_dur_member.append(i)

print(f"Lines with duration and member: {len(lines_with_dur_member)}")

# Check which ones have dates nearby
entries_without_date = []
for idx in lines_with_dur_member:
    # Look for date in nearby lines (5 lines forward, 3 lines back)
    has_date = False
    for j in range(max(0, idx - 3), min(len(text_lines), idx + 6)):
        line = clean_text(text_lines[j])
        if re.search(r'\d{2}/\d{2}/\d{4}', line):
            has_date = True
            break
    
    if not has_date:
        entries_without_date.append((idx, clean_text(text_lines[idx])))

print(f"\nEntries without date nearby: {len(entries_without_date)}")
if entries_without_date:
    print("\nFirst 10 entries without date:")
    for idx, (line_num, line) in enumerate(entries_without_date[:10]):
        # Show context
        print(f"\n  Line {line_num}: {line}")
        print(f"    Context (3 lines before and after):")
        for j in range(max(0, line_num - 3), min(len(text_lines), line_num + 4)):
            print(f"      {j}: {clean_text(text_lines[j])[:80]}")

