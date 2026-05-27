import re
import uuid
import random
from datetime import datetime, timedelta

from affinity_matrix import AFFINITY, normalize_article_type, get_user_group

def parse_sql_values(values_str):
    """
    Hàm hỗ trợ parse các giá trị trong ngoặc của INSERT INTO ... VALUES (...)
    Trả về list of strings/numbers.
    """
    # Xoá ngoặc đơn 2 đầu
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
    
    # Clean up results
    cleaned = []
    for p in parts:
        if p.upper() == 'NULL':
            cleaned.append(None)
        else:
            cleaned.append(p)
    return cleaned


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


def main():
    print("1. Đọc users từ import_users.sql...")
    users = []
    try:
        with open('import_users.sql', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if (line.startswith("('") and line.endswith("),")) or (line.startswith("('") and line.endswith(");")):
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
                            'group': get_user_group(gender, birth_year)
                        })
    except Exception as e:
        print("Lỗi đọc users:", e)
    print(f"Loaded {len(users)} users.")

    print("2. Đọc products từ import_products.sql...")
    products_db = {}
    product_categories = {}
    try:
        with open('import_products.sql', 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse product_categories (để lấy context)
        for match in re.finditer(r"INSERT INTO product_categories [^V]+VALUES\s*\((.*)\);", content):
            val_str = match.group(1)
            parts = parse_sql_values(val_str)
            if len(parts) >= 4:
                cat_id = parts[0]
                product_categories[cat_id] = {
                    'master': parts[1],
                    'sub': parts[2],
                    'article': normalize_article_type(parts[3])
                }

        # Parse products
        # INSERT INTO products (... ) VALUES ('uuid', 'name', 'brand', 'cat_id', 'mat_id', 'target_gender', 'desc', original_price, sale_price, ...)
        for match in re.finditer(r"INSERT INTO products [^V]+VALUES\s*\((.*)\);", content):
            val_str = match.group(1)
            parts = parse_sql_values(val_str)
            if len(parts) >= 9:
                p_id = parts[0]
                p_cat_id = parts[3]
                target_gender = str(parts[5]).lower()
                try:
                    p_price = float(parts[8]) # sale_price
                except:
                    p_price = 0
                article_type = product_categories.get(p_cat_id, {}).get('article', '')
                products_db[p_id] = {
                    'id': p_id,
                    'cat_id': p_cat_id,
                    'price': p_price,
                    'target_gender': target_gender,
                    'article_type': article_type
                }
    except Exception as e:
        print("Lỗi đọc products:", e)
    
    products = list(products_db.values())
    print(f"Loaded {len(products)} products and {len(product_categories)} categories.")

    group_allowed_genders = {
        'yf': {'female', 'unisex'},
        'af': {'female', 'unisex'},
        'ym': {'male', 'unisex'},
        'am': {'male', 'unisex'}
    }
    default_allowed_genders = {'male', 'female', 'unisex'}

    def build_group_pool(group, allowed_genders):
        pool = []
        weights = []
        for p in products:
            if p['target_gender'] not in allowed_genders:
                continue
            weight = AFFINITY.get(p['article_type'], {}).get(group, 0)
            if weight > 0:
                pool.append(p['id'])
                weights.append(weight)
        if not pool:
            pool = [p['id'] for p in products if p['target_gender'] in allowed_genders]
            if not pool:
                pool = [p['id'] for p in products]
            weights = [1.0 for _ in pool]
        return pool, weights

    group_pools = {
        g: build_group_pool(g, group_allowed_genders.get(g, default_allowed_genders))
        for g in ['yf', 'af', 'ym', 'am']
    }
    fallback_pool = ([p['id'] for p in products], [1.0 for _ in products])

    print("\nBắt đầu sinh wishlist...")
    wishlist_records = []
    wishlist_set = set() # Tránh trùng (user_id, product_id)
    
    now = datetime.now()
    
    # Yêu cầu: 20000 records wishlist. Mỗi user 40 items.
    for u in users:
        u_id = u['id']
        n_wishlist = 40
        pool, weights = group_pools.get(u['group'], fallback_pool)

        user_wishlist = weighted_sample_unique(pool, weights, n_wishlist)
        for p_id in user_wishlist:
            if (u_id, p_id) in wishlist_set:
                continue
            wishlist_set.add((u_id, p_id))
                
        # Tạo bản ghi
        for p_id in user_wishlist:
            days_ago = random.randint(0, 30)
            created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23))
            wishlist_records.append({
                'id': str(uuid.uuid4()),
                'user_id': u_id,
                'product_id': p_id,
                'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

    print(f"=> Đã tạo {len(wishlist_records)} bản ghi wishlist.")

    print("\nGhi file SQL...")
    with open('import_wishlist.sql', 'w', encoding='utf-8') as f:
        f.write("-- ============================================================\n")
        f.write("-- AUTO-GENERATED: Wishlist\n")
        f.write("-- ============================================================\n\n")

        # Wishlist
        if wishlist_records:
            f.write("INSERT INTO wishlist (id, user_id, product_id, created_at) VALUES\n")
            w_vals = []
            for w in wishlist_records:
                w_vals.append(f"('{w['id']}', '{w['user_id']}', '{w['product_id']}', '{w['created_at']}')")
            f.write(",\n".join(w_vals) + ";\n\n")
            
    print("Hoàn tất! File output: import_wishlist.sql")

if __name__ == '__main__':
    main()
