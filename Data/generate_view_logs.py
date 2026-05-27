import random
import re
from datetime import datetime, timedelta

from affinity_matrix import AFFINITY, normalize_article_type, get_user_group


def parse_sql_values(values_str):
    """Parse danh sách giá trị trong một dòng VALUES (...)."""
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
    return [None if p.upper() == 'NULL' else p for p in parts]

def main():
    print("Đang đọc users từ import_users.sql...")
    users = []
    with open('import_users.sql', 'r', encoding='utf-8') as f:
        # File users có các dòng dạng ('uuid', 'username', ...)
        for line in f:
            line = line.strip()
            if not line.startswith('('):
                continue
            if not (line.endswith('),') or line.endswith(');')):
                continue

            row_sql = line[:-1] if line.endswith(',') else line
            parts = parse_sql_values(row_sql)
            if len(parts) < 9:
                continue

            try:
                birth_year = int(float(parts[8]))
            except Exception:
                continue

            gender = str(parts[7]).lower()
            users.append({
                'id': str(parts[0]),
                'gender': gender,
                'birth_year': birth_year,
                'group': get_user_group(gender, birth_year)
            })
    print(f"Loaded {len(users)} users.")

    print("Đang đọc categories từ import_products.sql...")
    categories = {}
    with open('import_products.sql', 'r', encoding='utf-8') as f:
        content = f.read()

    for match in re.finditer(r"INSERT INTO product_categories\s*\([^)]*\)\s*VALUES\s*\((.*)\);", content):
        parts = parse_sql_values(match.group(1))
        if len(parts) < 4:
            continue

        cat_id = str(parts[0])
        master = str(parts[1])
        sub = str(parts[2])
        article = str(parts[3])
        categories[cat_id] = {
            'master': master,
            'sub': sub,
            'article': article
        }
    print(f"Loaded {len(categories)} categories.")

    print("Đang đọc products...")
    products = []
    for match in re.finditer(r"INSERT INTO products\s*\([^)]*\)\s*VALUES\s*\((.*)\);", content):
        parts = parse_sql_values(match.group(1))
        if len(parts) < 6:
            continue

        prod_id = str(parts[0])
        cat_id = str(parts[3])
        gender = str(parts[5])

        cat_info = categories.get(cat_id, {'master':'', 'sub':'', 'article':''})

        products.append({
            'id': prod_id,
            'cat_id': cat_id,
            'target_gender': gender.lower(),
            'article': normalize_article_type(cat_info['article']),
            'master': cat_info['master'],
            'sub': cat_info['sub']
        })
    print(f"Loaded {len(products)} products.")

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
            weight = AFFINITY.get(p['article'], {}).get(group, 0)
            if weight > 0:
                pool.append(p)
                weights.append(weight)
        if not pool:
            pool = [p for p in products if p['target_gender'] in allowed_genders]
            if not pool:
                pool = products
            weights = [1.0 for _ in pool]
        return pool, weights

    group_pools = {
        g: build_group_pool(g, group_allowed_genders.get(g, default_allowed_genders))
        for g in ['yf', 'af', 'ym', 'am']
    }
    fallback_pool = (products, [1.0 for _ in products])

    import uuid
    view_logs = []
    now = datetime.now()
    
    VIEWS_PER_USER = 240

    print("Bắt đầu sinh view logs...")
    for user in users:
        num_views = VIEWS_PER_USER
        pool, weights = group_pools.get(user['group'], fallback_pool)
        
        # Đảm bảo target bucket không bị trùng lặp quá nhiều hoặc thiếu
        for _ in range(num_views):
            prod = random.choices(pool, weights=weights, k=1)[0]
                
            duration = random.choices(
                [random.randint(10, 60), random.randint(60, 210), random.randint(210, 1200)],
                weights=[0.3, 0.5, 0.2]
            )[0]
            
            if duration <= 60:
                view_type = 'QUICK_VIEW'
            elif duration <= 210:
                view_type = 'DETAIL_VIEW'
            else:
                view_type = 'DEEP_VIEW' # Rất quan tâm, implicit intent
                
            # Random thời điểm trong 90 ngày
            days_ago = random.randint(0, 90)
            seconds_ago = random.randint(0, 24*3600)
            created_at = now - timedelta(days=days_ago, seconds=seconds_ago)
            
            view_logs.append({
                'id': str(uuid.uuid4()),
                'user_id': user['id'],
                'product_id': prod['id'],
                'view_type': view_type,
                'duration_seconds': duration,
                'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

    print(f"Tạo được tổng cộng {len(view_logs)} records.")
    
    # Mở tệp SQL để ghi
    with open('import_product_view_log.sql', 'w', encoding='utf-8') as f:
        f.write("-- ============================================================\n")
        f.write("-- AUTO-GENERATED: Product View Logs (AI implicit feedback)\n")
        f.write("-- ============================================================\n\n")
        
        # Chunk requests into multiple inserts
        chunk_size = 1000
        for i in range(0, len(view_logs), chunk_size):
            chunk = view_logs[i:i+chunk_size]
            f.write("INSERT INTO product_view_log (id, user_id, product_id, view_type, duration_seconds, created_at) VALUES\n")
            values = []
            for log in chunk:
                val = f"('{log['id']}', '{log['user_id']}', '{log['product_id']}', '{log['view_type']}', {log['duration_seconds']}, '{log['created_at']}')"
                values.append(val)
            f.write(",\n".join(values) + ";\n\n")
            
    print("Xong! File output: import_product_view_log.sql")

if __name__ == "__main__":
    main()
