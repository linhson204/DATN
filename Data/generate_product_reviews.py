import random
import uuid
from datetime import datetime, timedelta


TARGET_REVIEWS = 6000
RATING_WEIGHTS = [0, 0.05, 0.05, 0.2, 0.7]


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
    text = str(val).replace('\\', '\\\\').replace("'", "''")
    return f"'{text}'"


def parse_datetime(value):
    if not value:
        return None
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M:%S.%f'):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def build_comment(product_name, rating):
    positive_templates = [
        'Sản phẩm đúng mô tả, form đẹp và chất liệu ổn. Tôi rất hài lòng.',
        'Hàng nhận được khá tốt, đóng gói cẩn thận và mặc lên vừa vặn.',
        'Chất lượng vượt mong đợi, nhìn ngoài còn đẹp hơn hình.',
        'Mua về dùng rất thích, sản phẩm đáng tiền và giao hàng nhanh.',
    ]
    neutral_templates = [
        'Sản phẩm tạm ổn, đúng nhu cầu cơ bản của tôi.',
        'Trải nghiệm ở mức chấp nhận được, chưa có gì nổi bật.',
        'Hàng dùng được, nhưng tôi kỳ vọng thêm một chút về chất lượng.',
    ]
    negative_templates = [
        'Sản phẩm chưa như kỳ vọng, chất liệu và hoàn thiện chưa tốt.',
        'Form hơi lệch so với mô tả, trải nghiệm chưa hài lòng lắm.',
        'Hàng ở mức trung bình, cần cải thiện thêm về chất lượng.',
        'Tôi thấy sản phẩm chưa xứng với giá, hy vọng shop cải thiện.',
    ]

    if rating >= 4:
        template = random.choice(positive_templates)
    elif rating == 3:
        template = random.choice(neutral_templates)
    else:
        template = random.choice(negative_templates)

    return f'{product_name}: {template}'


def main():
    print('1. Đọc users từ import_users.sql...')
    users = set()
    try:
        with open('import_users.sql', 'r', encoding='utf-8') as file:
            for line in file:
                line = line.strip()
                if (line.startswith("('") and line.endswith('),')) or (line.startswith("('") and line.endswith(');')):
                    parts = parse_sql_values(line)
                    if parts:
                        users.add(parts[0])
    except Exception as error:
        print('Lỗi đọc users:', error)

    print('2. Đọc orders và order_items từ import_orders.sql...')
    orders = {}
    order_items = []
    section = None
    try:
        with open('import_orders.sql', 'r', encoding='utf-8') as file:
            for raw_line in file:
                line = raw_line.strip()
                if line.startswith('INSERT INTO orders '):
                    section = 'orders'
                    continue
                if line.startswith('INSERT INTO order_items '):
                    section = 'order_items'
                    continue
                if not line.startswith('('):
                    continue

                if section == 'orders' and (line.endswith(',') or line.endswith(';')):
                    parts = parse_sql_values(line)
                    if len(parts) >= 11:
                        order_id = parts[0]
                        user_id = parts[1]
                        status = str(parts[3]).upper()
                        created_at = parse_datetime(parts[10])
                        orders[order_id] = {
                            'user_id': user_id,
                            'status': status,
                            'created_at': created_at,
                        }
                elif section == 'order_items' and (line.endswith(',') or line.endswith(';')):
                    parts = parse_sql_values(line)
                    if len(parts) >= 12:
                        order_items.append({
                            'order_id': parts[1],
                            'product_id': parts[3],
                            'product_name': parts[4],
                        })
    except Exception as error:
        print('Lỗi đọc orders:', error)

    delivered_pairs = []
    seen_pairs = set()
    for item in order_items:
        order = orders.get(item['order_id'])
        if not order or order['status'] != 'DELIVERED':
            continue

        user_id = order['user_id']
        if user_id not in users:
            continue

        pair_key = (user_id, item['product_id'])
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)

        delivered_pairs.append({
            'user_id': user_id,
            'product_id': item['product_id'],
            'product_name': item['product_name'],
            'order_created_at': order['created_at'],
        })

    print(f'Loaded {len(delivered_pairs)} unique purchased pairs from delivered orders.')

    if not delivered_pairs:
        print('Không tìm thấy dữ liệu đủ điều kiện để sinh review.')
        return

    if len(delivered_pairs) > TARGET_REVIEWS:
        selected_pairs = random.sample(delivered_pairs, TARGET_REVIEWS)
    else:
        selected_pairs = delivered_pairs

    now = datetime.now()
    reviews = []
    rating_counter = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for pair in selected_pairs:
        rating = random.choices([1, 2, 3, 4, 5], weights=RATING_WEIGHTS, k=1)[0]
        rating_counter[rating] += 1

        created_at = pair['order_created_at'] or now - timedelta(days=random.randint(1, 120))
        review_time = created_at + timedelta(days=random.randint(1, 21), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        if review_time > now:
            review_time = now - timedelta(minutes=random.randint(1, 120))

        comment = None
        if random.random() < 0.88:
            comment = build_comment(pair['product_name'], rating)

        reviews.append({
            'id': str(uuid.uuid4()),
            'user_id': pair['user_id'],
            'product_id': pair['product_id'],
            'rating': rating,
            'comment': comment,
            'created_at': review_time.strftime('%Y-%m-%d %H:%M:%S'),
        })

    print(f'3. Sinh xong {len(reviews)} review.')
    print('Phân bố sao:', rating_counter)

    with open('import_product_reviews.sql', 'w', encoding='utf-8') as file:
        file.write('-- ============================================================\n')
        file.write('-- AUTO-GENERATED: Product Reviews\n')
        file.write('-- Chỉ review từ đơn hàng DELIVERED, không trùng (user_id, product_id)\n')
        file.write('-- ============================================================\n\n')
        file.write('INSERT INTO product_reviews (id, user_id, product_id, rating, comment, created_at, updated_at) VALUES\n')

        values = []
        for review in reviews:
            values.append(
                f"({escape_sql(review['id'])}, {escape_sql(review['user_id'])}, {escape_sql(review['product_id'])}, "
                f"{review['rating']}, {escape_sql(review['comment'])}, {escape_sql(review['created_at'])}, {escape_sql(review['created_at'])})"
            )

        file.write(',\n'.join(values) + ';\n')

    print('Hoàn tất! File output: import_product_reviews.sql')


if __name__ == '__main__':
    main()