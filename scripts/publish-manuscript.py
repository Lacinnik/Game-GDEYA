"""Package the unmodified author DOCX and its original chapter headings."""
import hashlib
import html
import json
from pathlib import Path
import shutil
import sys
from xml.etree import ElementTree as ET
from zipfile import ZipFile

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'public-web/public/library/architectonics-2-2'
target.mkdir(parents=True, exist_ok=True)
with ZipFile(source) as package:
    document = ET.fromstring(package.read('word/document.xml'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
books = []
for p in document.findall('.//w:body/w:p', ns):
    style = p.find('w:pPr/w:pStyle', ns)
    name = style.get('{%s}val' % ns['w']) if style is not None else ''
    text = ''.join(t.text or '' for t in p.findall('.//w:t', ns))
    if name == 'Heading1' and text != 'Общее содержание':
        books.append({'number': len(books) + 1, 'title': text, 'chapters': []})
    elif name == 'Heading2' and books:
        books[-1]['chapters'].append(text)
assert len(books) == 10, 'Expected exactly ten books'
filename = 'architectonics-books-1-10-edition-2.2.docx'
shutil.copyfile(source, target / filename)
digest = hashlib.sha256(source.read_bytes()).hexdigest()
assert hashlib.sha256((target / filename).read_bytes()).hexdigest() == digest
manifest = {'title': 'Архитектоника психики', 'author': 'Александр Лацинник', 'edition': '2.2', 'publication_date': '2026-09-20', 'source_filename': source.name, 'download': filename, 'sha256': digest, 'bytes': source.stat().st_size, 'books': books}
(target / 'edition.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
chapters = ''.join('<details><summary><span>Книга %02d</span> %s</summary><ul>%s</ul></details>' % (b['number'], html.escape(b['title']), ''.join('<li>'+html.escape(c)+'</li>' for c in b['chapters'])) for b in books)
page = '''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Архитектоника психики Александра Лацинника. Все десять книг, редакция 2.2. Полный авторский DOCX и оглавление."><title>Архитектоника психики · Редакция 2.2</title><link rel="stylesheet" href="../library.css"></head><body><header><a href="../../platform/">⊕ Платформа ТЕЗАР</a><a href="../../platform/revision/">Ревизия продуктов</a></header><main><p class="eyebrow">АЛЕКСАНДР ЛАЦИННИК · ДЕСЯТЬ КНИГ</p><h1>Архитектоника<br>психики</h1><p class="lead">Введение в различение, Ядро субъекта, взаимное внимание и переход к действию.</p><p>Редакция 2.2 · Литературная редактура</p><a class="download" href="FILE" download>Скачать полное собрание · DOCX ↓</a><p class="note">Оригинальный авторский файл, 10 книг, 248 КБ. Формулы и оформление сохранены. Опубликовано 20 сентября 2026 года.</p><section><h2>Содержание собрания</h2><p>Раскройте книгу, чтобы увидеть её разделы. Для полного текста скачайте собрание.</p>CHAPTERS</section><section><h2>Об издании</h2><p>Авторская теоретическая и практическая система. Рукопись различает наблюдение, интерпретацию, внутреннюю проверку и эмпирический результат. Девятая книга представляет проект исследования со статусом HOLD_PROTOCOL; издание не сообщает о подтверждённой эффективности метода.</p><p><a href="edition.json">Сведения о редакции и контрольная сумма</a></p></section></main><footer>© 2026 Александр Лацинник · <a href="../../platform/">Вернуться к продуктам</a></footer></body></html>'''.replace('FILE', filename).replace('CHAPTERS', chapters)
(target / 'index.html').write_text(page)
print(json.dumps({'sha256': digest, 'books': len(books), 'bytes': source.stat().st_size}))
