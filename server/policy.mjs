import {defaults} from './store.mjs';
const programIds = new Set(Object.keys(defaults.programs));
const textKeys = new Set(['aboutTitle','programsTitle','resourcesTitle','discoverTitle','faqTitle','finalTitle']);
const topText = new Set(['title','description','date','place','phone','email']);
const admissions = new Set(['code','year','profile','status','ege','spo','entrance','duration','notes']);
const forbiddenKeys = new Set(['__proto__','constructor','prototype']);
export class HttpError extends Error {constructor(status, message) {super(message); this.status = status;}}
export const fail = (status, message) => {throw new HttpError(status, message);};

export function validateJson(value, depth = 0) {
  if (depth > 14) fail(400, 'Слишком сложная структура данных.');
  if (typeof value === 'string') {if (value.length > 40000 || value.includes('\0')) fail(400, 'Слишком длинный текст.'); return;}
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') fail(400, 'Некорректные данные.');
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key) || key.length > 100 || /[.\[\]]/.test(key)) fail(400, 'Недопустимое имя поля.');
    validateJson(child, depth + 1);
  }
}
export function changedFields(before, after, prefix = '', result = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return result;
  if (before && typeof before === 'object' || after && typeof after === 'object') {
    const a = before && typeof before === 'object' ? before : {}, b = after && typeof after === 'object' ? after : {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    if (!keys.size) result.push({path:prefix,before,after});
    for (const key of keys) changedFields(a[key], b[key], prefix ? prefix + '.' + key : key, result);
    // Array lengths and container types are also permissions, not text edits.
    if (before !== undefined && after !== undefined && (Array.isArray(before) !== Array.isArray(after) || typeof before !== typeof after || before === null || after === null)) result.push({path: prefix, before, after});
    if (Array.isArray(before) && Array.isArray(after) && before.length !== after.length) result.push({path: prefix + '.length', before: before.length, after: after.length});
  } else result.push({path: prefix, before, after});
  return result;
}
export function canEditText({path, before, after}) {
  if (after !== undefined && typeof after !== 'string' || before !== undefined && typeof before !== 'string') return false;
  if (topText.has(path)) return after !== undefined;
  const parts = path.split('.');
  if (parts.length === 2 && parts[0] === 'texts' && textKeys.has(parts[1])) return true;
  if (/^blocks\.[a-z0-9_-]+\.elements\.[a-z0-9_-]+\.(text|placeholder|alt)$/.test(path)) return true;
  if (parts[0] !== 'programs' || !programIds.has(parts[1])) return false;
  if (parts.length === 3 && ['name','faculty'].includes(parts[2])) return after !== undefined;
  if (parts[2] !== 'admission') return false;
  if (parts.length === 4 && admissions.has(parts[3])) return true;
  return typeof before === 'string' && typeof after === 'string' && (/^programs\.[a-z0-9_-]+\.admission\.rows\.\d+\.\d+$/.test(path) || /^programs\.[a-z0-9_-]+\.admission\.headers\.\d+$/.test(path));
}
const safeUrl = value => typeof value === 'string' && value.length <= 2048 && !/[\x00-\x20\\]/.test(value) && !value.startsWith('//') && /^(https?:\/\/|\/?[a-zA-Z0-9_#?./-])/.test(value) && !/^(javascript|data|vbscript):/i.test(value);
const fonts = new Set(['Steppe','Arial','Verdana','Georgia','Trebuchet MS','Times New Roman']);
const styleLimits = {fontSize:[8,180],mobileFontSize:[8,100],lineHeight:[.8,3],letterSpacing:[-8,20],padding:[0,160],borderRadius:[0,100]};
function validateStyle(style) {
  if (!style || Array.isArray(style) || typeof style !== 'object') fail(400, 'Некорректное оформление.');
  for (const [key, value] of Object.entries(style)) {
    if (value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number') fail(400, 'Некорректное значение оформления.');
    const valid = styleLimits[key] ? (typeof value === 'string' || typeof value === 'number') && Number.isFinite(Number(value)) && Number(value) >= styleLimits[key][0] && Number(value) <= styleLimits[key][1]
      : ['color','backgroundColor'].includes(key) ? /^#[\da-f]{6}$/i.test(value)
      : key === 'fontFamily' ? fonts.has(value) : key === 'fontWeight' ? /^(400|500|600|700|800)$/.test(value)
      : key === 'textAlign' ? ['left','center','right'].includes(value) : key === 'objectFit' ? ['cover','contain'].includes(value) : false;
    if (!valid) fail(400, 'Некорректное значение оформления: ' + key);
  }
}
export function validateContent(content) {
  validateJson(content);
  if (!content || Array.isArray(content)) fail(400, 'Некорректный контент.');
  const roots = new Set([...Object.keys(defaults), 'facts']);
  for (const key of Object.keys(content)) if (!roots.has(key)) fail(400, 'Неизвестное поле контента.');
  for (const key of topText) if (typeof content[key] !== 'string') fail(400, 'Текстовые поля должны содержать текст.');
  if (!content.title.trim()) fail(400, 'Добавьте заголовок сайта.');
  for (const key of ['accent','secondary','background']) if (!/^#[\da-f]{6}$/i.test(content[key])) fail(400, 'Некорректный цвет.');
  if (!fonts.has(content.font)) fail(400, 'Некорректный шрифт.');
  if (content.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) fail(400, 'Проверьте электронную почту.');
  if (!content.sections || typeof content.sections !== 'object' || Array.isArray(content.sections)) fail(400, 'Некорректные разделы.');
  for (const [key,value] of Object.entries(content.sections)) if (!Object.hasOwn(defaults.sections,key) || typeof value !== 'boolean') fail(400, 'Некорректная видимость раздела.');
  if (!content.texts || Array.isArray(content.texts) || typeof content.texts !== 'object') fail(400, 'Некорректные тексты.');
  for (const [key,value] of Object.entries(content.texts)) if (!textKeys.has(key) || typeof value !== 'string') fail(400, 'Некорректный текст раздела.');
  if (!content.programs || Array.isArray(content.programs) || typeof content.programs !== 'object') fail(400, 'Некорректный каталог.');
  for (const [id,p] of Object.entries(content.programs)) {
    if (!programIds.has(id) || !p || Array.isArray(p) || typeof p !== 'object') fail(400, 'Неизвестное направление.');
    for (const key of ['name','faculty','level','document','cost']) if (p[key] !== undefined && typeof p[key] !== 'string' && !(p[key] === null && ['document','cost'].includes(key))) fail(400, 'Некорректные данные направления.');
    for (const key of ['document','cost']) if (p[key] && !/^https?:\/\//.test(p[key])) fail(400, 'Ссылка должна начинаться с https:// или http://.');
    if (p.visible !== undefined && typeof p.visible !== 'boolean') fail(400, 'Некорректная видимость направления.');
    const a = p.admission;
    if (a) {
      if (typeof a !== 'object' || Array.isArray(a)) fail(400, 'Некорректные условия приёма.');
      for (const key of admissions) if (a[key] !== undefined && typeof a[key] !== 'string') fail(400, 'Условия приёма должны содержать текст.');
      if (a.headers && (!Array.isArray(a.headers) || a.headers.length > 30 || a.headers.some(x=>typeof x !== 'string'))) fail(400, 'Некорректные столбцы.');
      if (a.rows && (!Array.isArray(a.rows) || a.rows.length > 150 || a.rows.some(row=>!Array.isArray(row) || row.length > 30 || row.some(x=>typeof x !== 'string')))) fail(400, 'Некорректная таблица.');
    }
  }
  if (content.facts && (!Array.isArray(content.facts) || content.facts.length > 100 || content.facts.some(x=>typeof x !== 'string'))) fail(400, 'Некорректные сведения об университете.');
  if (!content.blocks || typeof content.blocks !== 'object' || Array.isArray(content.blocks)) fail(400, 'Некорректные блоки.');
  for (const [id,block] of Object.entries(content.blocks)) {
    if (!/^[a-z0-9_-]+$/.test(id) || !block || Array.isArray(block) || typeof block !== 'object') fail(400, 'Некорректный блок.');
    for (const key of Object.keys(block)) if (!['hidden','style','elements'].includes(key)) fail(400, 'Неизвестная настройка блока.');
    if (block.hidden !== undefined && typeof block.hidden !== 'boolean') fail(400, 'Некорректная видимость блока.');
    if (block.style) validateStyle(block.style);
    if (block.elements && (typeof block.elements !== 'object' || Array.isArray(block.elements))) fail(400, 'Некорректные элементы.');
    for (const [field,element] of Object.entries(block.elements || {})) {
      if (!/^[a-z0-9_-]+$/.test(field) || !element || typeof element !== 'object' || Array.isArray(element)) fail(400, 'Некорректный элемент.');
      for (const [key,value] of Object.entries(element)) {
        if (key === 'style') validateStyle(value);
        else if (!['text','href','src','alt','placeholder'].includes(key) || typeof value !== 'string') fail(400, 'Неизвестная настройка элемента.');
        else if (['href','src'].includes(key) && !safeUrl(value)) fail(400, 'Некорректный адрес ссылки или фотографии.');
      }
    }
  }
}
