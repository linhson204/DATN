import re
import uuid
import random
from datetime import datetime, timedelta
from faker import Faker

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
    for p in parts:
        if p.upper() == 'NULL':
            cleaned.append(None)
        else:
            cleaned.append(p)
    return cleaned

def escape_sql(val):
    if val is None:
        return 'NULL'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    # Escape single quotes and backslashes for SQL
    s = str(val).replace("\\", "\\\\").replace("'", "''")
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

def main():
    fake = Faker('vi_VN')
    
    # 1. Đọc Users
    print("1. Đọc users từ import_users.sql...")
    users = []
    user_dict = {}
    try:
        with open('import_users.sql', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if (line.startswith("('") and line.endswith("),")) or (line.startswith("('") and line.endswith(");")):
                    parts = parse_sql_values(line)
                    if len(parts) >= 9:
                        u_id = parts[0]
                        u_name = parts[3]
                        u_email = parts[4]
                        u_phone = parts[5]
                        u_gender = str(parts[7]).lower()
                        try:
                            birth_year = int(float(parts[8]))
                        except Exception:
                            birth_year = None
                        users.append({
                            'id': u_id,
                            'group': get_user_group(u_gender, birth_year)
                        })
                        user_dict[u_id] = {
                            'name': u_name,
                            'email': u_email,
                            'phone': u_phone
                        }
    except Exception as e:
        print("Lỗi đọc users:", e)
    print(f"Loaded {len(users)} users.")

    # 2. Đọc Products & Variants
    print("2. Đọc products & variants từ import_products.sql...")
    products_db = {}
    product_categories = {}
    total_variants_loaded = 0
    try:
        with open('import_products.sql', 'r', encoding='utf-8') as f:
            content = f.read()

        for match in re.finditer(r"INSERT INTO product_categories\s*\([^)]*\)\s*VALUES\s*\((.*)\);", content):
            parts = parse_sql_values(match.group(1))
            if len(parts) < 4:
                continue
            cat_id = str(parts[0])
            article = normalize_article_type(parts[3])
            product_categories[cat_id] = {'article': article}

        for match in re.finditer(r"INSERT INTO products [^V]+VALUES\s*\((.*)\);", content):
            val_str = match.group(1)
            parts = parse_sql_values(val_str)
            if len(parts) >= 9:
                p_id = parts[0]
                p_name = parts[1]
                target_gender = str(parts[5]).lower()
                p_cat_id = parts[3]
                p_image_url = parts[11] if len(parts) >= 12 else None
                article_type = product_categories.get(p_cat_id, {}).get('article', '')
                products_db[p_id] = {
                    'id': p_id,
                    'name': p_name,
                    'variants': [],
                    'target_gender': target_gender,
                    'article_type': article_type,
                    'image_url': p_image_url
                }
                
        for match in re.finditer(r"INSERT INTO product_variants [^V]+VALUES\s*\((.*)\);", content):
            val_str = match.group(1)
            parts = parse_sql_values(val_str)
            if len(parts) >= 8:
                v_id = parts[0]
                p_id = parts[1]
                sku = parts[2]
                size = parts[3]
                color = parts[4]
                try:
                    v_sale = float(parts[7])
                except:
                    v_sale = 0
                v_image_url = parts[9] if len(parts) >= 10 else None
                    
                if p_id in products_db:
                    products_db[p_id]['variants'].append({
                        'id': v_id,
                        'sku': sku,
                        'size': size,
                        'color': color,
                        'price': v_sale,
                        'image_url': v_image_url
                    })
                    total_variants_loaded += 1
    except Exception as e:
        print("Lỗi đọc products:", e)
    
    # Lọc ra các products có variants
    valid_products = [p for p in products_db.values() if len(p['variants']) > 0]
    print(f"Loaded {len(valid_products)} valid products and {total_variants_loaded} variants.")

    if not valid_products:
        print("Lỗi: Không tìm thấy product nào có variants!")
        return

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
        for p in valid_products:
            if p['target_gender'] not in allowed_genders:
                continue
            weight = AFFINITY.get(p['article_type'], {}).get(group, 0)
            if weight > 0:
                pool.append(p)
                weights.append(weight)
        if not pool:
            pool = [p for p in valid_products if p['target_gender'] in allowed_genders]
            if not pool:
                pool = valid_products
            weights = [1.0 for _ in pool]
        return pool, weights

    group_pools = {
        g: build_group_pool(g, group_allowed_genders.get(g, default_allowed_genders))
        for g in ['yf', 'af', 'ym', 'am']
    }
    fallback_pool = (valid_products, [1.0 for _ in valid_products])

    # 4. Generate Orders
    print("\nBắt đầu sinh orders và order_items...")
    
    orders = []
    order_items = []
    delivery_infos = []
    
    statuses = ['DELIVERED', 'PENDING', 'CANCELLED']
    status_weights = [0.6, 0.35, 0.05]
    methods = ['Standard', 'Express', 'Next Day']
    payment_methods = ['COD', 'MOMO', 'ZALOPAY']
    payment_method_weights = [0.50, 0.25, 0.20]
    
    now = datetime.now()
    ORDERS_PER_USER = 10
    
    for u in users:
        u_id = u['id']
        pool, weights = group_pools.get(u['group'], fallback_pool)

        for _ in range(ORDERS_PER_USER):
            order_id = str(uuid.uuid4())
            delivery_id = str(uuid.uuid4())
            status = random.choices(statuses, weights=status_weights)[0]
            
            # Phân bố thời gian random 90 ngày
            days_ago = random.randint(1, 90)
            created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
            
            # Thông tin delivery
            u_info = user_dict.get(u_id, {'name': 'Khach Hang', 'email': 'kh@example.com', 'phone': '0123'})
            
            # 80% lấy tên của user, 20% tên random (đặt hộ)
            if random.random() < 0.8:
                rec_name = u_info['name']
                rec_phone = u_info['phone']
            else:
                rec_name = fake.name()
                rec_phone = fake.phone_number()
                rec_phone = "".join([c for c in rec_phone if c.isdigit() or c == '+'])[:15]
                
            delivery_address = "Việt Nam"
            shipping_fee = random.choice([30000, 40000, 50000]) if random.random() < 0.8 else 0  # 20% freeship
            d_time = 'Trong giờ hành chính' if random.random() < 0.7 else 'Ngoài giờ hành chính'
            d_inst = random.choice(['Giao trước khi gọi', 'Giao cho bảo vệ', '', 'Chỉ gọi buổi chiều', ''])

            delivery_infos.append({
                'id': delivery_id,
                'recipient_name': rec_name,
                'email': u_info['email'],
                'phone_number': rec_phone,
                'address': delivery_address,
                'delivery_method': random.choice(methods),
                'delivery_time': d_time,
                'delivery_instructions': d_inst,
                'created_at': created_at
            })
            
            payment_method = random.choices(payment_methods, weights=payment_method_weights)[0]
            if status == 'CANCELLED':
                payment_status = 'UNPAID'
            elif payment_method == 'COD':
                payment_status = 'PAID' if status in ['DELIVERED'] else 'UNPAID'
            else:
                payment_status = 'PAID'
                if status in ['PENDING'] and random.random() < 0.2:
                    payment_status = 'UNPAID'

            payment_app_trans_id = None
            payment_transaction_id = None
            if payment_method != 'COD' and payment_status == 'PAID':
                payment_app_trans_id = f"APP{created_at.strftime('%Y%m%d')}{random.randint(100000, 999999)}"
                payment_transaction_id = str(uuid.uuid4())

            # --- Items (1-4 products) ---
            n_items = random.randint(1, 4)
            order_total = 0

            selected_products = weighted_sample_unique(pool, weights, n_items)
            if not selected_products:
                selected_products = [random.choice(valid_products)]

            for p_info in selected_products:
                v_info = random.choice(p_info['variants'])
                qty = random.choices([1, 2, 3], weights=[0.8, 0.15, 0.05])[0]
                price = v_info['price']
                line_total = price * qty
                image_url = v_info.get('image_url') or p_info.get('image_url')

                order_items.append({
                    'id': str(uuid.uuid4()),
                    'order_id': order_id,
                    'variant_id': v_info['id'],
                    'product_id': p_info['id'],
                    'product_name': p_info['name'],
                    'image_url': image_url,
                    'sku': v_info['sku'],
                    'size': v_info['size'],
                    'color': v_info['color'],
                    'unit_price': price,
                    'quantity': qty,
                    'line_total': line_total
                })
                order_total += line_total
                
            # Finish order (if items > 0)
            if selected_products:
                orders.append({
                    'id': order_id,
                    'user_id': u_id,
                    'delivery_info_id': delivery_id,
                    'status': status,
                    'shipping_fee': shipping_fee,
                    'total_amount': order_total,
                    'payment_method': payment_method,
                    'payment_status': payment_status,
                    'payment_app_trans_id': payment_app_trans_id,
                    'payment_transaction_id': payment_transaction_id,
                    'created_at': created_at
                })

    print(f"=> Đã tạo {len(orders)} orders và {len(order_items)} order_items.")
    
    print("\nGhi file SQL...")
    with open('import_orders.sql', 'w', encoding='utf-8') as f:
        f.write("-- ============================================================\n")
        f.write("-- AUTO-GENERATED: Delivery Infos, Orders, Order Items\n")
        f.write("-- ============================================================\n\n")
        

        # DELIVERY INFOS
        # Batching
        def chunker(seq, size):
            return (seq[pos:pos + size] for pos in range(0, len(seq), size))
            
        f.write("-- 1. INSERT DELIVERY_INFOS\n")
        for chunk in chunker(delivery_infos, 500):
            f.write("INSERT INTO delivery_infos (id, recipient_name, email, phone_number, address, delivery_method, delivery_time, delivery_instructions, created_at) VALUES\n")
            vals = []
            for d in chunk:
                vals.append(f"({escape_sql(d['id'])}, {escape_sql(d['recipient_name'])}, {escape_sql(d['email'])}, "
                            f"{escape_sql(d['phone_number'])}, {escape_sql(d['address'])}, {escape_sql(d['delivery_method'])}, "
                            f"{escape_sql(d['delivery_time'])}, {escape_sql(d['delivery_instructions'])}, {escape_sql(d['created_at'].strftime('%Y-%m-%d %H:%M:%S'))})")
            f.write(",\n".join(vals) + ";\n\n")
            
        # ORDERS
        f.write("-- 2. INSERT ORDERS\n")
        for chunk in chunker(orders, 500):
            f.write("INSERT INTO orders (id, user_id, delivery_info_id, status, shipping_fee, total_amount, payment_method, payment_status, payment_app_trans_id, payment_transaction_id, created_at) VALUES\n")
            vals = []
            for o in chunk:
                vals.append(f"({escape_sql(o['id'])}, {escape_sql(o['user_id'])}, {escape_sql(o['delivery_info_id'])}, "
                            f"{escape_sql(o['status'])}, {o['shipping_fee']}, {o['total_amount']}, {escape_sql(o['payment_method'])}, "
                            f"{escape_sql(o['payment_status'])}, {escape_sql(o['payment_app_trans_id'])}, {escape_sql(o['payment_transaction_id'])}, "
                            f"{escape_sql(o['created_at'].strftime('%Y-%m-%d %H:%M:%S'))})")
            f.write(",\n".join(vals) + ";\n\n")
            
        # ORDER ITEMS
        f.write("-- 3. INSERT ORDER ITEMS\n")
        for chunk in chunker(order_items, 500):
            f.write("INSERT INTO order_items (id, order_id, variant_id, product_id, product_name, image_url, sku, size, color, unit_price, quantity, line_total) VALUES\n")
            vals = []
            for oi in chunk:
                vals.append(f"({escape_sql(oi['id'])}, {escape_sql(oi['order_id'])}, {escape_sql(oi['variant_id'])}, "
                            f"{escape_sql(oi['product_id'])}, {escape_sql(oi['product_name'][:250])}, {escape_sql(oi['image_url'])}, "
                            f"{escape_sql(oi['sku'])}, {escape_sql(oi['size'])}, {escape_sql(oi['color'])}, "
                            f"{oi['unit_price']}, {oi['quantity']}, {oi['line_total']})")
            f.write(",\n".join(vals) + ";\n\n")

    print("Hoàn tất! File output: import_orders.sql")

if __name__ == '__main__':
    main()
