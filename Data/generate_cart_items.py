import re
import uuid
import random
from datetime import datetime, timedelta

from affinity_matrix import AFFINITY, normalize_article_type, get_user_group


def parse_sql_values(values_str):
    values_str = values_str.strip()
    if values_str.startswith('('):
        values_str = values_str[1:]
    if values_str.endswith(')'):
        values_str = values_str[:-1]

    parts = []
    current = []
    in_string = False
    escape = False
    for char in values_str:
        if in_string:
            if escape:
                current.append(char)
                escape = False
            elif char == '\\':
                escape = True
                current.append(char)
            elif char == "'":
                in_string = False
            else:
                current.append(char)
        else:
            if char == "'":
                in_string = True
            elif char == ',':
                parts.append(''.join(current).strip())
                current = []
            else:
                current.append(char)
    parts.append(''.join(current).strip())

    cleaned = []
    for part in parts:
        if part.upper() == 'NULL':
            cleaned.append(None)
        else:
            cleaned.append(part)
    return cleaned


def escape_sql(val):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    s = str(val).replace('\\', '\\\\').replace("'", "''")
    return f"'{s}'"


def weighted_sample_unique(items, weights, k):
    if not items or k <= 0:
        return []
    if k >= len(items):
        return list(items)

    pool = list(items)
    pool_weights = list(weights)
    picked = []
    for _ in range(k):
        if not pool:
            break
        idx = random.choices(range(len(pool)), weights=pool_weights, k=1)[0]
        picked.append(pool.pop(idx))
        pool_weights.pop(idx)
    return picked


def chunker(seq, size):
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))


def load_users():
    users = []
    with open('import_users.sql', 'r', encoding='utf-8') as file:
        for line in file:
            line = line.strip()
            if (line.startswith("('") and line.endswith('),')) or (line.startswith("('") and line.endswith(');')):
                parts = parse_sql_values(line)
                if len(parts) >= 9:
                    user_id = parts[0]
                    gender = str(parts[7]).lower()
                    try:
                        birth_year = int(float(parts[8]))
                    except Exception:
                        birth_year = None
                    users.append({
                        'id': user_id,
                        'gender': gender,
                        'birth_year': birth_year,
                        'group': get_user_group(gender, birth_year),
                    })
    return users


def load_products():
    products_db = {}
    product_categories = {}

    with open('import_products.sql', 'r', encoding='utf-8') as file:
        content = file.read()

    for match in re.finditer(r"INSERT INTO product_categories [^V]+VALUES\s*\((.*)\);", content):
        parts = parse_sql_values(match.group(1))
        if len(parts) >= 4:
            cat_id = parts[0]
            product_categories[cat_id] = {
                'article': normalize_article_type(parts[3]),
            }

    for match in re.finditer(r"INSERT INTO products [^V]+VALUES\s*\((.*)\);", content):
        parts = parse_sql_values(match.group(1))
        if len(parts) >= 9:
            product_id = parts[0]
            cat_id = parts[3]
            target_gender = str(parts[5]).lower()
            try:
                sale_price = float(parts[8])
            except Exception:
                sale_price = 0

            products_db[product_id] = {
                'id': product_id,
                'name': parts[1],
                'image_url': parts[11] if len(parts) >= 12 else None,
                'target_gender': target_gender,
                'article_type': product_categories.get(cat_id, {}).get('article', ''),
                'variants': [],
                'price': sale_price,
            }

    total_variants_loaded = 0
    for match in re.finditer(r"INSERT INTO product_variants [^V]+VALUES\s*\((.*)\);", content):
        parts = parse_sql_values(match.group(1))
        if len(parts) >= 8:
            variant_id = parts[0]
            product_id = parts[1]
            sku = parts[2]
            size = parts[3]
            color = parts[4]
            try:
                sale_price = float(parts[7])
            except Exception:
                sale_price = 0
            image_url = parts[9] if len(parts) >= 10 else None

            if product_id in products_db:
                products_db[product_id]['variants'].append({
                    'id': variant_id,
                    'sku': sku,
                    'size': size,
                    'color': color,
                    'price': sale_price,
                    'image_url': image_url,
                })
                total_variants_loaded += 1

    valid_products = [product for product in products_db.values() if product['variants']]
    return valid_products, total_variants_loaded


def load_purchased_variants_by_user():
    orders = {}
    section = None

    with open('import_orders.sql', 'r', encoding='utf-8') as file:
        for raw_line in file:
            line = raw_line.strip()

            if line.startswith('INSERT INTO orders '):
                section = 'orders'
                continue
            if line.startswith('INSERT INTO order_items '):
                section = 'order_items'
                continue
            if line.startswith('INSERT INTO '):
                section = None
                continue

            if section == 'orders' and (line.endswith(',') or line.endswith(';')):
                parts = parse_sql_values(line)
                if len(parts) >= 11:
                    order_id = parts[0]
                    orders[order_id] = {
                        'user_id': parts[1],
                        'status': str(parts[3]).upper(),
                        'variants': [],
                    }

            if section == 'order_items' and (line.endswith(',') or line.endswith(';')):
                parts = parse_sql_values(line)
                if len(parts) >= 12:
                    order_id = parts[1]
                    variant_id = parts[2]
                    orders.setdefault(order_id, {'user_id': None, 'status': None, 'variants': []})
                    orders[order_id]['variants'].append(variant_id)

    user_to_variants = {}
    for order_info in orders.values():
        user_id = order_info.get('user_id')
        if not user_id:
            continue
        if str(order_info.get('status', '')).upper() == 'CANCELLED':
            continue
        for variant_id in order_info.get('variants', []):
            user_to_variants.setdefault(user_id, set()).add(variant_id)

    return user_to_variants


def main():
    random.seed()
    now = datetime.now()

    print('1. Đọc users...')
    users = load_users()
    print(f'Loaded {len(users)} users.')

    print('2. Đọc products & variants...')
    valid_products, total_variants_loaded = load_products()
    print(f'Loaded {len(valid_products)} valid products and {total_variants_loaded} variants.')

    print('3. Đọc lịch sử order...')
    purchased_variants_by_user = load_purchased_variants_by_user()
    print(f'Loaded purchase history for {len(purchased_variants_by_user)} users.')

    group_allowed_genders = {
        'yf': {'female', 'unisex'},
        'af': {'female', 'unisex'},
        'ym': {'male', 'unisex'},
        'am': {'male', 'unisex'},
    }
    default_allowed_genders = {'male', 'female', 'unisex'}

    def build_group_pool(group, allowed_genders):
        pool = []
        weights = []
        for product in valid_products:
            if product['target_gender'] not in allowed_genders:
                continue
            weight = AFFINITY.get(product['article_type'], {}).get(group, 0)
            if weight > 0:
                pool.append(product)
                weights.append(weight)
        if not pool:
            pool = [product for product in valid_products if product['target_gender'] in allowed_genders]
            if not pool:
                pool = valid_products
            weights = [1.0 for _ in pool]
        return pool, weights

    group_pools = {
        group: build_group_pool(group, group_allowed_genders.get(group, default_allowed_genders))
        for group in ['yf', 'af', 'ym', 'am']
    }
    fallback_pool = (valid_products, [1.0 for _ in valid_products])

    print('\nBắt đầu sinh cart_items...')
    cart_items = []
    used_pairs = set()

    for user in users:
        user_id = user['id']
        group = user['group']
        pool, weights = group_pools.get(group, fallback_pool)
        blocked_variants = purchased_variants_by_user.get(user_id, set())

        candidate_variants = []
        candidate_weights = []
        for product, weight in zip(pool, weights):
            available_variants = [variant for variant in product['variants'] if variant['id'] not in blocked_variants]
            if not available_variants:
                continue
            variant_weight = weight / max(len(product['variants']), 1)
            for variant in available_variants:
                candidate_variants.append((product, variant))
                candidate_weights.append(variant_weight)

        if not candidate_variants:
            fallback_variants = []
            fallback_weights = []
            for product in valid_products:
                for variant in product['variants']:
                    if variant['id'] in blocked_variants:
                        continue
                    fallback_variants.append((product, variant))
                    fallback_weights.append(1.0)
            candidate_variants = fallback_variants
            candidate_weights = fallback_weights

        target_count = random.randint(4, 5)
        selected = weighted_sample_unique(candidate_variants, candidate_weights, min(target_count, len(candidate_variants)))

        if len(selected) < target_count:
            remaining = [item for item in candidate_variants if item not in selected]
            random.shuffle(remaining)
            selected.extend(remaining[:target_count - len(selected)])

        for product, variant in selected:
            pair_key = (user_id, variant['id'])
            if pair_key in used_pairs:
                continue
            used_pairs.add(pair_key)

            quantity = random.choices([1, 2, 3], weights=[0.7, 0.22, 0.08])[0]
            created_at = now - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            updated_at = created_at + timedelta(minutes=random.randint(1, 120))

            cart_items.append({
                'id': str(uuid.uuid4()),
                'user_id': user_id,
                'variant_id': variant['id'],
                'quantity': quantity,
                'is_selected': random.choices([1, 0], weights=[0.78, 0.22])[0],
                'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            })

    print(f'=> Đã tạo {len(cart_items)} bản ghi cart_items.')

    print('\nGhi file SQL...')
    with open('import_cart_items.sql', 'w', encoding='utf-8') as file:
        file.write('-- ============================================================\n')
        file.write('-- AUTO-GENERATED: Cart Items\n')
        file.write('-- Mỗi user có khoảng 4-5 món trong cart, loại trừ món đã order\n')
        file.write('-- ============================================================\n\n')
        file.write('INSERT INTO cart_items (id, user_id, variant_id, quantity, is_selected, created_at, updated_at) VALUES\n')

        values = []
        for item in cart_items:
            values.append(
                f"({escape_sql(item['id'])}, {escape_sql(item['user_id'])}, {escape_sql(item['variant_id'])}, "
                f"{item['quantity']}, {item['is_selected']}, {escape_sql(item['created_at'])}, {escape_sql(item['updated_at'])})"
            )
        file.write(',\n'.join(values) + ';\n')

    print('Hoàn tất! File output: import_cart_items.sql')


if __name__ == '__main__':
    main()