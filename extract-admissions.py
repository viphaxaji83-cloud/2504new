from pathlib import Path
from PIL import Image
import numpy as np
import json,re

root=Path(__file__).parent
data=json.loads((root/'dist/data.json').read_text('utf-8-sig'))
meta=json.loads((root/'table-crops/meta.json').read_text())
fixes={'профшњный':'профильный','Информатгжа':'Информатика','Математшса':'Математика','Хикшя':'Химия','Ху,пипя':'Химия','Маппжное':'Машинное','Машш-1ное':'Машинное','больштк':'больших','даншэ1х':'данных','дашнх':'данных','ба.л.л':'балл','алпиьный':'альный','граящане':'граждане','штостраш-љ1е':'иностранные','элементалш':'элементами','анггшйского':'английского','язьпса':'языка'}
def clean(s):
 for a,b in fixes.items():s=s.replace(a,b)
 s=re.sub(r'\s+',' ',s).strip()
 s=re.sub(r'(?<=\w)- (?=[а-я])','',s)
 return s
def groups(vals):
 out=[]
 for v in vals:
  if not out or v>out[-1][-1]+2:out.append([])
  out[-1].append(int(v))
 return [round(sum(g)/len(g)) for g in out]
def joinwords(words):
 rows=[]
 for z in sorted(words,key=lambda z:z['y']+z['height']/2):
  cy=z['y']+z['height']/2
  row=next((r for r in rows if abs(r[0]-cy)<20),None)
  if row is None:row=[cy,[]];rows.append(row)
  row[1].append(z)
 return clean(' '.join(' '.join(w['text'] for w in sorted(r[1],key=lambda z:z['x'])) for r in rows))
report=[]
closed={'eco_tovaroved':'38.03.07','himiya':'04.03.01','innov':'27.03.05','ser':'43.03.01','standimetrolog':'27.03.01'}
for p in data['programs']:
 id=p['id'];a={'code':closed.get(id,''),'year':'2026–2027','profile':'','status':'','headers':[],'rows':[],'ege':'','spo':'','entrance':'','duration':'','notes':''}
 p['admission']=a
 if id in closed:
  a['status']='Набор на 2026–2027 учебный год не ведётся';p['image']=None;continue
 d=json.loads((root/f'extracted-programs/program-{id}.json').read_text('utf-8-sig'))
 lines=d['lines'];whole=clean(d['text']);m=re.search(r'\d{2}[.,]\d{2}[.,]\d{2}',whole)
 if m:a['code']=m[0].replace(',','.')
 elif p.get('document'):
  m=re.search(r'\d{2}\.\d{2}\.\d{2}',p['document']);a['code']=m[0] if m else ''
 if id=='specld':a['code']='31.05.01'
 if id=='eco_men':a['code']='38.03.02';a['notes']='Условия приёма можно уточнить в приёмной комиссии МГТУ.';continue
 key='program-'+id;t=meta[key]
 profile=[]
 for l in lines:
  y=min(w['y'] for w in l['words'])/d['height']*t['height']
  if y<t['top']-10 and re.search('Профиль|Специализац',l['text'],re.I):profile.append(l['text'])
  elif profile and y<t['top']-35 and not re.search('План|Форма',l['text']):profile.append(l['text'])
 a['profile']=re.sub(r'^(Профиль\s+подготовк[Ии]|Специализация)\s*:\s*','',clean(' '.join(profile)))
 # The original grid supplies cell boundaries; OCR supplies text inside each cell.
 im=Image.open(root/f'dist/assets/{key}.jpg').convert('L');arr=np.array(im)<130;h,w=arr.shape
 td=json.loads((root/f'extracted-tables/{key}.json').read_text('utf-8-sig'));sx=td['width']/w;sy=td['height']/(t['bottom']+1-t['top'])
 words=[]
 for z in [z for l in td['lines'] for z in l['words']]:
  z=dict(z);z['cx']=(z['x']+z['width']/2)/sx;z['cy']=(z['y']+z['height']/2)/sy+t['top'];words.append(z)
 nums=[z['cy'] for z in words if re.fullmatch(r'очная|очно-|заочная',z['text'],re.I)] or [z['cy'] for z in words if re.fullmatch(r'\d+|З',z['text'])]
 if not nums:raise Exception('No table numbers: '+id)
 first=min(nums);ys=t['lines'];start=max(y for y in ys if y<first-4);end=t['bottom']
 xs=groups(np.where(arr[round(start)+3:end-2].mean(axis=0)>.93)[0])
 bodyys=[round(y) for y in ys if y>=start-1]
 n=len(xs)-1
 if n not in [3,4,5,6]:report.append('CHECK columns '+id+' '+str(xs))
 a['headers']=(['Профиль','Форма обучения','Бюджет','По договору'] if p['level']=='Магистратура' and n==4 else ['Форма обучения','Бюджет','Отдельная квота','Особая квота','По договору'] if n==5 else ['Форма обучения','Бюджет','По договору'] if n==3 else ['Профиль / форма','Бюджет','Квоты','По договору'][:n])
 if n==6:a['headers']=['Профиль / подразделение','Форма обучения','Бюджет','Отдельная квота','Особая квота','По договору']
 if id=='specld':a['headers'][0]='Специализация'
 for y1,y2 in zip(bodyys,bodyys[1:]):
  row=[]
  for x1,x2 in zip(xs,xs[1:]):
   # Merged source cells are repeated so each resulting row stands on its own.
   mid=round((x1+x2)/2);boundaries=[round(y) for y in ys if arr[max(0,round(y)-2):round(y)+3,max(0,mid-3):mid+4].mean()>.35]
   ylo=max([y for y in boundaries if y<=y1+2]+[round(start)]);yhi=min([y for y in boundaries if y>=y2-2]+[end])
   cell=[z for z in words if x1<z['cx']<x2 and ylo<z['cy']<yhi]
   value=joinwords(cell).replace('очно- заочная','очно-заочная') or '—'
   if value=='З':value='3'
   row.append(value)
  a['rows'].append(row)
 # Text below the table is grouped into the original named sections.
 sections={'ege':[],'spo':[],'entrance':[],'duration':[],'notes':[]};section=None;skip=False
 rows=[]
 for l in lines:
  y=min(z['y'] for z in l['words'])/d['height']*h
  if y>end+5:rows.append((y,l['text']))
 for y,text in sorted(rows):
  if re.search('Вступ.*ЕГЭ',text,re.I):section='ege';skip=True;continue
  if re.search('Профильные вступ',text,re.I):section='spo';skip=True;continue
  if re.search('Нормативный',text,re.I):section='duration';skip=False;continue
  if re.search('Информацию о стоимости',text,re.I):break
  if p['level']=='Магистратура' and re.search('Вступ.*испытания:',text,re.I):section='entrance';skip=False;continue
  if section:
   if skip:
    if not re.match(r'^\s*[1IІl][ .]',text):continue
    skip=False
   sections[section].append(text)
 for name,ls in sections.items():
  val=clean(' '.join(ls));val=re.sub(r'\s+([123З])\s*[.]\s*',lambda m:'\n'+('3' if m[1]=='З' else m[1])+'. ',val)
  val=re.sub(r'^1\s*[.]?\s*','1. ',val);a[name]=val
 # Higher-resolution text crops, merged by page coordinates.
 bw=[]
 for k,(lo,hi) in enumerate([(end+2,min(h,end+380)),(min(h,end+350),h)]):
  bd=json.loads((root/f'extracted-bodies/{key}-{k}.json').read_text('utf-8-sig'))
  for z in [z for l in bd['lines'] for z in l['words']]:
   z=dict(z);z['x']*=w/bd['width'];z['width']*=w/bd['width'];z['y']=lo+z['y']*(hi-lo)/bd['height'];z['height']*=(hi-lo)/bd['height']
   if (k==0 and z['y']<end+363) or (k==1 and z['y']>=end+363):
    z['x']*=3;z['y']*=3;z['width']*=3;z['height']*=3;bw.append(z)
 body=joinwords(bw)
 if p['level']=='Магистратура':
  m=re.search(r'[:;]\s*(.*?)\s*\(мин.*?40 из 100\)',body)
  if m:a['entrance']=m[1]+' (минимальный балл: 40 из 100).'
  a['notes']='Испытание проводится на русском языке в устной форме по билетам. Сдача — очно в университете или с использованием дистанционных технологий.'
 else:
  eg=re.search(r'ЕГЭ.*?[:;](.*?)(?:Проф[^ ]*\s+вступ|Нормативный)',body,re.I)
  sp=re.search(r'Проф[^ ]*\s+вступ.*?(?:балл|ба.л.л).*?[:;](.*?)(?:Нормативный|Информац)',body,re.I)
  du=re.search(r'Нормативный.*?обучения\s*[:;](.*?)(?:Информац|QR)',body,re.I)
  if eg:a['ege']=eg[1].strip()
  if sp:a['spo']=sp[1].strip()
  if du:a['duration']=du[1].strip()
 report.append(id+' | '+a['code']+' | '+a['profile']+'\n  '+'\n  '.join(' / '.join(r) for r in a['rows'])+'\n  EGE '+a['ege']+'\n  SPO '+a['spo']+'\n  ENT '+a['entrance']+'\n  DUR '+a['duration'])
(root/'dist/data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
(root/'extraction-review.txt').write_text('\n\n'.join(report),encoding='utf8')
print('Prepared admissions:',len(data['programs']))

