#!/usr/bin/env python3
import pdfplumber
import re

pdf_path = 'reportes_csv/intek-medical-final.pdf'
with pdfplumber.open(pdf_path) as pdf:
    text_lines = []
    for page in pdf.pages:
        page_text = page.extract_text()
        if page_text:
            text_lines.extend(page_text.split('\n'))
    
    # Find ALL duration patterns
    all_durations = []
    for i, line in enumerate(text_lines):
        clean_line = line.strip()
        # Skip the total line at the top
        if i < 10 and '483:31:35' in clean_line:
            continue
        dur_matches = re.findall(r'(\d+):(\d{2}):(\d{2})', clean_line)
        for match in dur_matches:
            all_durations.append((i, clean_line, match))
    
    print(f"Total duration patterns found: {len(all_durations)}")
    
    # Find entries with member (our current capture)
    entries_with_member = []
    for i, line in enumerate(text_lines):
        clean_line = line.strip()
        dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', clean_line)
        if dur_match and any(member in clean_line for member in ['Dani', 'Alberto', 'Joan', 'Jordi']):
            entries_with_member.append((i, clean_line, dur_match.groups()))
    
    print(f"Entries with member in same line: {len(entries_with_member)}")
    
    # Find durations near members (within 2 lines)
    entries_near_member = []
    for i, line in enumerate(text_lines):
        clean_line = line.strip()
        dur_match = re.search(r'(\d+):(\d{2}):(\d{2})', clean_line)
        if dur_match:
            # Check if there's a member nearby
            has_member_nearby = False
            member_name = None
            for j in range(max(0, i-2), min(len(text_lines), i+3)):
                nearby = text_lines[j].strip()
                for member in ['Dani', 'Alberto', 'Joan', 'Jordi']:
                    if member in nearby:
                        has_member_nearby = True
                        member_name = member
                        break
                if has_member_nearby:
                    break
            
            if has_member_nearby and (i, clean_line, dur_match.groups()) not in entries_with_member:
                entries_near_member.append((i, clean_line, dur_match.groups(), member_name))
    
    print(f"Entries with member nearby (not in same line): {len(entries_near_member)}")
    if entries_near_member:
        print("\nFirst few entries with member nearby:")
        for idx, (line_num, line, dur, member) in enumerate(entries_near_member[:10]):
            print(f"  Line {line_num}: {line[:80]} -> Member: {member}")
    
    # Calculate totals
    total_with_member = sum(
        int(h)*3600 + int(m)*60 + int(s) 
        for _, _, (h, m, s) in entries_with_member
    )
    
    total_near_member = sum(
        int(h)*3600 + int(m)*60 + int(s) 
        for _, _, (h, m, s), _ in entries_near_member
    )
    
    combined_total = total_with_member + total_near_member
    h = combined_total // 3600
    m = (combined_total % 3600) // 60
    s = combined_total % 60
    
    print(f"\nTotal with member in same line: {total_with_member // 3600}:{(total_with_member % 3600) // 60:02d}:{total_with_member % 60:02d}")
    if total_near_member > 0:
        print(f"Total with member nearby: {total_near_member // 3600}:{(total_near_member % 3600) // 60:02d}:{total_near_member % 60:02d}")
        print(f"Combined total: {h}:{m:02d}:{s:02d}")

