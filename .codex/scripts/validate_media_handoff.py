"""Offline handoff checks. Does not call providers or grant rights/approval."""
import argparse
import json
from pathlib import Path


import hashlib
import re


def validate(data, *, dry_run=False):
    errors = []

    def require(condition, message):
        if not condition:
            errors.append(message)

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def obj(value):
        return value if isinstance(value, dict) else {}

    def strings(value):
        return isinstance(value, list) and bool(value) and all(text(v) for v in value)

    if not isinstance(data, dict):
        return ['manifest must be an object']
    fixture = data.get('fixture') is True
    require(type(data.get('fixture')) is bool, 'fixture must be explicit boolean')
    require(not fixture or dry_run, 'synthetic fixture requires --dry-run')
    require(not fixture or text(data.get('fixture_notice')), 'fixture notice required')
    require(data.get('schema_version') == 1, 'schema_version must be 1')
    stage = data.get('stage')
    require(stage in ('research', 'ready', 'native-verified'), 'invalid stage')
    for field in ('project', 'master_path', 'ui_kit_path', 'cover_id'):
        require(text(data.get(field)), f'{field} required')
    scene = obj(data.get('scene'))
    for field in ('concept', 'distinct_from_other_covers'):
        require(text(scene.get(field)), f'scene.{field} required')
    require(strings(scene.get('immutable_details')), 'immutable_details required')
    palette = obj(data.get('palette'))
    for field in ('background', 'text', 'accent'):
        require(bool(re.fullmatch(r'#[0-9a-fA-F]{6}', str(palette.get(field)))), f'palette.{field}: hex required')
    require(text(palette.get('master_comparison')), 'MASTER comparison required')
    for viewport in ('desktop', 'mobile'):
        layout = obj(obj(data.get('layout')).get(viewport))
        size = layout.get('size')
        require(isinstance(size, list) and len(size) == 2 and all(type(n) is int and n > 0 for n in size), f'{viewport} size required')
        for field in ('crop', 'subject', 'text_safe_area'):
            require(text(layout.get(field)), f'{viewport}.{field} required')
    comparison = obj(data.get('comparison'))
    require(comparison.get('rubric_type') == 'implementation rubric', 'rubric must not impersonate client requirements')
    require(strings(comparison.get('criteria')), 'comparison criteria required')
    require(text(comparison.get('selected_reason')), 'selected_reason required')
    rejected = comparison.get('rejections')
    require(isinstance(rejected, list) and bool(rejected) and all(text(obj(r).get('candidate')) and text(obj(r).get('reason')) for r in rejected), 'rejections required')
    refs = data.get('refs')
    if not isinstance(refs, list) or not refs or not all(isinstance(r, dict) for r in refs):
        return errors + ['refs must be nonempty object array']
    ids, paths, roles, products, labels = [], [], set(), set(), set()
    for ref in refs:
        name = str(ref.get('id', '?'))
        for field in ('id', 'source', 'page_url', 'original_url', 'original_path', 'preview_path'):
            require(text(ref.get(field)), f'{name}.{field} required')
        ids.append(str(ref.get('id')))
        paths.append(str(ref.get('original_path')))
        role = ref.get('role')
        require(role in ('scene', 'product', 'label'), f'{name}: invalid role')
        if isinstance(role, str):
            roles.add(role)
        if role in ('product', 'label'):
            sku = ref.get('sku')
            require('sku' in ref and (sku is None or text(sku)), f'{name}: SKU must be a nonempty string or explicit null')
            if text(sku):
                identity = ('sku', sku)
            else:
                field = 'product_id' if text(ref.get('product_id')) else 'slug'
                value = ref.get(field)
                require(text(value), f'{name}: null SKU requires product_id or slug')
                require(ref.get('identity_verified') is True and text(ref.get('identity_evidence')),
                        f'{name}: stable identity requires catalog verification evidence')
                identity = (field, value if text(value) else None)
            (products if role == 'product' else labels).add(identity)
        rights = obj(ref.get('rights'))
        require(rights.get('classification') in ('reference-only', 'permitted-AI-input', 'publishable'), f'{name}: rights classification required')
        require(text(rights.get('basis')) and text(rights.get('checked_at')), f'{name}: rights basis/date required')
        require(type(rights.get('ai_permission')) is bool, f'{name}: explicit AI permission required')
        require(type(rights.get('publication_permission')) is bool, f'{name}: publication permission required')
        ai_ok = rights.get('ai_permission') is True and text(rights.get('ai_evidence')) and rights.get('classification') != 'reference-only'
        vision = obj(ref.get('vision'))
        if stage != 'research':
            require(ai_ok, f'{name}: no clear AI permission')
            require(vision.get('loaded') is True and text(vision.get('evidence')), f'{name}: actual vision load evidence required')
        if vision.get('loaded') is True:
            require(ai_ok, f'{name}: vision is AI transfer too')
        digest = ref.get('sha256')
        require(isinstance(digest, str) and bool(re.fullmatch('[0-9a-f]{64}', digest)), f'{name}: sha256 required')
        if not fixture:
            for field in ('original_path', 'preview_path'):
                path = Path(str(ref.get(field, '')))
                require(path.is_absolute() and path.is_file(), f'{name}: missing absolute {field}')
            path = Path(str(ref.get('original_path', '')))
            if path.is_file():
                require(hashlib.sha256(path.read_bytes()).hexdigest() == digest, f'{name}: original hash mismatch')
            require(not any(str(ref.get(f, '')).startswith('fixture:') for f in ('source', 'page_url', 'original_url')), f'{name}: synthetic provenance in real manifest')
    require(roles == {'scene', 'product', 'label'}, 'separate scene, product and label refs required')
    require(products == labels, 'each stable product identity needs matching product and label refs')
    require(len(ids) == len(set(ids)), 'duplicate ref ids')
    require(len(paths) == len(set(paths)), 'roles must use separate files, not one collage')
    transfer = obj(data.get('transfer'))
    generation = obj(data.get('generation'))
    if stage == 'research':
        require(data.get('transfer') is None and data.get('generation') is None, 'research must not transfer or generate')
    else:
        require(transfer.get('method') in ('delegate_task.images', 'agent-vision-load'), 'explicit image transfer method required')
        require(transfer.get('ref_ids') == ids, 'dropped, reordered or extra transfer ref')
        require(text(transfer.get('evidence')), 'transfer evidence required')
        require(generation.get('route') == 'codex-native-image', 'image route must be native Codex')
        require(generation.get('pilot_only') is True, 'one pilot before scaling')
        require(text(generation.get('owner_approval')) and text(generation.get('budget_approval')), 'pilot owner/budget approval required')
        if stage == 'native-verified':
            native = obj(generation.get('native_call'))
            require(native.get('referenced_image_paths') == paths, 'dropped, reordered or extra native ref: no first-image fallback')
            evidence_path = native.get('evidence_path')
            require(text(evidence_path), 'native evidence_path required')
            if not fixture and text(evidence_path):
                try:
                    evidence = json.loads(Path(str(evidence_path)).read_text())
                    require(isinstance(evidence, dict) and evidence.get('referenced_image_paths') == paths, 'native evidence refs mismatch')
                except (OSError, ValueError):
                    errors.append('native evidence file unreadable')
    publication = obj(data.get('publication'))
    require(type(publication.get('approved')) is bool, 'explicit publication approval flag required')
    if publication.get('approved') is True:
        require(stage == 'native-verified' and text(publication.get('owner_approval')), 'production requires native verification and owner approval')
        require(all(obj(r.get('rights')).get('publication_permission') is True for r in refs), 'publication rights missing')
    if not fixture:
        for field in ('master_path', 'ui_kit_path'):
            path = Path(str(data.get(field, '')))
            require(path.is_absolute() and path.is_file(), f'{field} must exist')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--dry-run', action='store_true', help='Allow explicitly synthetic fixtures; never generates')
    args = parser.parse_args()
    try:
        errors = validate(json.loads(args.manifest.read_text()), dry_run=args.dry_run)
    except (ValueError, OSError, TypeError) as exc:
        errors = [str(exc)]
    print(json.dumps({'valid': not errors, 'errors': errors, 'generation_executed': False}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
