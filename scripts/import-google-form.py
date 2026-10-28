"""Import an original Forms CSV ZIP. Dry run by default; --save writes private records.
Raw export stays outside the repository. Exact source rows have stable IDs;
repeat imports skip existing records and preserve staff edits. No email queue writes.
"""
import argparse, csv, hashlib, io, json, re, zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

FORM_ID = '1IvLgBA5bQkdSFfEAcjmltIlJkuyKZCLmYy9iDakoWpc'

def measurement(value, height=False):
    text = value.strip().lower().replace(',', '.')
    match = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(cm|см|m|м)?', text)
    if not match: return None
    number = float(match[1]); unit = match[2]
    if unit in ('m', 'м') or (height and 1 <= number <= 2.5): number *= 100
    # Bare small circumferences can be inches or bra sizes: do not guess.
    if (height and number < 50) or (not height and number < 40): return None
    return round(number, 1) if 0 < number <= 300 else None

def convert(headers, row):
    row = row + [''] * (len(headers)-len(row))
    submitted = datetime.strptime(re.sub(r'GMT([+-])(\d{1,2})$', lambda m: 'GMT'+m[1]+m[2].zfill(2)+'00', row[0]), '%Y/%m/%d %I:%M:%S %p GMT%z').isoformat()
    birth = datetime.strptime(row[3], '%Y-%m-%d').date().isoformat() if row[3].strip() else None
    urls = re.findall(r'https?://[^\s<>]+', row[20])
    portfolio = row[21].strip()
    return dict(source='Google Form', external_id=FORM_ID+':'+hashlib.sha256(json.dumps(row,ensure_ascii=False).encode()).hexdigest(), submitted_at=submitted, imported_at=datetime.now(timezone.utc).isoformat(), full_name=' '.join(x.strip() for x in row[1:3]).strip(), birth_date=birth, location=', '.join(x.strip() for x in [row[6],row[4]] if x.strip()), email=row[7].strip(), instagram=row[8].strip(), height=measurement(row[9],True), bust_chest=measurement(row[10]), waist=measurement(row[11]), hips=measurement(row[12]), tattoos={'yes':True,'no':False}.get(row[17].strip().lower()), piercings=None, heard_about=row[22], portfolio_url=portfolio if re.fullmatch(r'https?://\S+',portfolio) else None, legacy_photo_urls=urls, legacy_response=dict(zip(headers,row)))

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('export');parser.add_argument('--save',action='store_true');args=parser.parse_args()
    with zipfile.ZipFile(args.export) as archive:
        names=[n for n in archive.namelist() if n.endswith('.csv')]
        if len(names)!=1: raise ValueError('Expected one CSV')
        rows=list(csv.reader(io.StringIO(archive.read(names[0]).decode('utf-8-sig'))))
    records=[convert(rows[0],row) for row in rows[1:] if any(row)]
    if any(not r['full_name'] or len(r['full_name'])>200 for r in records):raise ValueError('Invalid name; review export')
    unique={r['external_id']:r for r in records}
    print(json.dumps({'responses':len(records),'unique_source_rows':len(unique),'unparsed_measurements':sum(r[k] is None for r in records for k in ['height','bust_chest','waist','hips']),'with_photo_links':sum(bool(r['legacy_photo_urls']) for r in records),'mode':'save' if args.save else 'dry-run'}))
    if not args.save:return
    env={}
    for line in (Path(__file__).resolve().parents[1]/'.env.local').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);env[k]=v.strip().strip('\"\'')
    def api(path,body=None):
        request=Request(env['SUPABASE_URL']+'/rest/v1/'+path,data=json.dumps(body).encode() if body is not None else None,headers={'apikey':env['SUPABASE_SECRET_KEY'],'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=representation'})
        with urlopen(request,timeout=45) as response:return json.load(response)
    saved=api('applications?on_conflict=source,external_id',list(unique.values()))
    # Imported records do not enter application_notifications.
    all_records=api('applications?source=eq.Google%20Form&select=id,external_id&limit=10000')
    events=api('application_events?event_type=eq.imported&select=application_id&limit=10000'); existing={e['application_id'] for e in events}
    missing=[dict(application_id=r['id'],event_type='imported',details={'source':'Google Form','form_id':FORM_ID}) for r in all_records if r['external_id'] in unique and r['id'] not in existing]
    if missing:api('application_events',missing)
    print(json.dumps({'inserted':len(saved),'already_present':len(unique)-len(saved),'verified_records':sum(r['external_id'] in unique for r in all_records),'import_events_added':len(missing)}))

if __name__=='__main__':main()
