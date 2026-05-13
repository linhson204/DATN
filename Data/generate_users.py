import uuid
import random
import bcrypt
from faker import Faker

def escape_sql(val):
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    # xâu chuỗi
    return "'" + str(val).replace("'", "''") + "'"

def main():
    fake = Faker('vi_VN')
    
    # Hash password "Test@123" 1 lần để dùng chung
    password = b"Test@123"
    salt = bcrypt.gensalt(rounds=10)
    password_hash = bcrypt.hashpw(password, salt).decode('utf-8')
    
    # Cấu hình nhóm users theo yêu cầu
    groups = [
        {"name": "Young female", "count": 40, "gender": "female", "year_range": (2000, 2005)},
        {"name": "Adult female", "count": 35, "gender": "female", "year_range": (1985, 1999)},
        {"name": "Young male",   "count": 40, "gender": "male",   "year_range": (2000, 2005)},
        {"name": "Adult male",   "count": 35, "gender": "male",   "year_range": (1985, 1999)},
    ]
    
    sql_lines = []
    sql_lines.append("-- ============================================================")
    sql_lines.append("-- TẠO GIẢ LẬP 150 USERS THEO MẪU PHÂN BỐ")
    sql_lines.append("-- Mật khẩu cho tất cả user mặc định là: Test@123")
    sql_lines.append("-- ============================================================")
    sql_lines.append(" ")
    sql_lines.append("INSERT INTO users (id, username, password_hash, full_name, email, phone_number, address, gender, birth_year, role_id, status, points, balance, total_purchase, membership_level) VALUES")
    
    values_list = []
    
    for group in groups:
        sql_lines.append(f"\n-- Nhóm: {group['name']} ({group['count']} users)")
        for _ in range(group['count']):
            user_id = str(uuid.uuid4())
            
            # Username & Email
            username = fake.user_name() + str(random.randint(100, 999))
            email = username + "@example.com"
            
            # Name setup theo giới tính
            if group['gender'] == 'male':
                full_name = fake.name_male()
            elif group['gender'] == 'female':
                full_name = fake.name_female()
            else:
                full_name = fake.name()
                
            phone_number = fake.phone_number()
            # Xử lý độ dài phone_number để an toàn cho VARCHAR(20)
            phone_number = "".join([c for c in phone_number if c.isdigit() or c == '+'])[:15]
            
            address = "Việt Nam"
            gender = group['gender']
            birth_year = random.randint(group['year_range'][0], group['year_range'][1])
            
            # Role ID giả định 1 là USER
            role_id = 2
            status = True
            points = random.randint(0, 500)
            balance = round(random.uniform(0, 5000000), 2)
            total_purchase = round(random.uniform(0, 20000000), 2)
            
            if total_purchase > 10000000:
                membership_level = 'gold'
            elif total_purchase > 5000000:
                membership_level = 'silver'
            else:
                membership_level = 'basic'

            val_str = f"({escape_sql(user_id)}, {escape_sql(username)}, {escape_sql(password_hash)}, {escape_sql(full_name)}, {escape_sql(email)}, {escape_sql(phone_number)}, {escape_sql(address)}, {escape_sql(gender)}, {birth_year}, {role_id}, {escape_sql(status)}, {points}, {balance}, {total_purchase}, {escape_sql(membership_level)})"
            
            values_list.append(val_str)
            
    # Gộp các value lại (chia thành các batch hoặc gộp chung 1 lệnh insert)
    sql_lines.append(",\n".join(values_list) + ";")
    
    with open('import_users.sql', 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))
        
    print("Đã tạo file import_users.sql với 150 users!")

if __name__ == '__main__':
    main()
