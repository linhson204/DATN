"""
Đọc dữ liệu sản phẩm đã dịch thủ công và sinh file import_products.sql
để import sản phẩm vào database Spring Boot.
"""
import os
import pandas as pd
import uuid
import random
import re
import math

try:
    import sample_2000
except Exception:
    sample_2000 = None

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

SOURCE_FILE_CANDIDATES = [
    'styles_sampled_tieng_viet.csv',
    'styles_sampled.csv'
]


def resolve_source_file():
    if os.path.exists(SOURCE_FILE_CANDIDATES[0]):
        return SOURCE_FILE_CANDIDATES[0]
    for path in SOURCE_FILE_CANDIDATES[1:]:
        if os.path.exists(path):
            return path
    return SOURCE_FILE_CANDIDATES[0]


SOURCE_FILE = resolve_source_file()

# ============================================================
# KHOẢNG GIÁ THEO LOẠI SẢN PHẨM (VNĐ)
# ============================================================
PRICE_RANGES = {
    # Apparel - Topwear
    'Tshirts': (150_000, 550_000),
    'Shirts': (250_000, 850_000),
    'Tops': (200_000, 600_000),
    'Kurtas': (300_000, 900_000),
    'Kurtis': (250_000, 700_000),
    'Tunics': (300_000, 800_000),
    'Jackets': (500_000, 2_000_000),
    'Sweaters': (400_000, 1_200_000),
    'Sweatshirts': (350_000, 1_000_000),
    'Dupatta': (150_000, 500_000),
    'Blazers': (800_000, 2_500_000),
    'Waistcoat': (500_000, 1_500_000),
    # Apparel - Bottomwear
    'Jeans': (350_000, 1_200_000),
    'Trousers': (300_000, 1_000_000),
    'Shorts': (200_000, 600_000),
    'Track Pants': (200_000, 700_000),
    'Leggings': (150_000, 450_000),
    'Capris': (200_000, 500_000),
    'Skirts': (250_000, 800_000),
    # Apparel - Dress
    'Dresses': (350_000, 1_500_000),
    # Apparel - Innerwear
    'Briefs': (80_000, 250_000),
    'Bra': (150_000, 500_000),
    'Innerwear Vests': (80_000, 200_000),
    'Trunk': (100_000, 300_000),
    # Apparel - others
    'Sarees': (500_000, 2_500_000),
    'Nightdress': (200_000, 600_000),
    'Night suits': (250_000, 700_000),
    'Kurta Sets': (500_000, 1_500_000),
    # Accessories
    'Watches': (500_000, 5_000_000),
    'Sunglasses': (300_000, 2_000_000),
    'Handbags': (300_000, 2_000_000),
    'Backpacks': (250_000, 1_200_000),
    'Clutches': (200_000, 800_000),
    'Duffel Bag': (300_000, 1_000_000),
    'Wallets': (200_000, 800_000),
    'Belts': (150_000, 600_000),
    'Socks': (50_000, 150_000),
    'Earrings': (100_000, 500_000),
    'Pendant': (150_000, 800_000),
    'Necklace and Chains': (200_000, 1_000_000),
    'Ring': (100_000, 600_000),
    'Ties': (150_000, 500_000),
    'Caps': (100_000, 400_000),
    'Scarves': (150_000, 500_000),
    'Stoles': (200_000, 600_000),
    'Cufflinks': (150_000, 500_000),
    # Footwear
    'Casual Shoes': (300_000, 1_500_000),
    'Sports Shoes': (400_000, 2_500_000),
    'Formal Shoes': (400_000, 2_000_000),
    'Heels': (300_000, 1_500_000),
    'Flats': (200_000, 800_000),
    'Flip Flops': (100_000, 400_000),
    'Sandals': (150_000, 600_000),
}
DEFAULT_PRICE_RANGE = (200_000, 800_000)

# ============================================================
# MATERIAL DICTIONARY
# (code, name, quality_score)
# ============================================================
MATERIALS = [
    ('cotton',          'Vải cotton',            65),
    ('polyester',       'Vải polyester',          40),
    ('cotton_blend',    'Vải cotton pha',         55),
    ('poly_blend',      'Vải polyester pha',      45),
    ('silk',            'Lụa',                    85),
    ('wool',            'Len',                    75),
    ('linen',           'Vải lanh',               70),
    ('denim',           'Vải denim (jeans)',      60),
    ('nylon',           'Vải nylon',              50),
    ('leather',         'Da thật',               80),
    ('faux_leather',    'Da giả',                45),
    ('canvas',          'Vải canvas',             55),
    ('suede',           'Da lộn',                70),
    ('satin',           'Vải satin',              65),
    ('chiffon',         'Vải chiffon',            60),
    ('velvet',          'Nhung',                  72),
    ('rubber',          'Cao su',                 35),
    ('stainless_steel', 'Thép không gỉ',         78),
    ('metal_alloy',     'Hợp kim',                55),
    ('acrylic',         'Nhựa acrylic',           38),
]

# Map articleType -> list of possible material codes (weighted random)
MATERIAL_MAPPING = {
    # Topwear
    'Tshirts':      ['cotton', 'cotton_blend', 'polyester', 'poly_blend'],
    'Shirts':       ['cotton', 'cotton_blend', 'linen', 'polyester'],
    'Tops':         ['cotton', 'chiffon', 'polyester', 'cotton_blend'],
    'Kurtas':       ['cotton', 'silk', 'cotton_blend', 'linen'],
    'Kurtis':       ['cotton', 'silk', 'cotton_blend', 'chiffon'],
    'Tunics':       ['cotton', 'chiffon', 'linen', 'silk'],
    'Jackets':      ['leather', 'faux_leather', 'nylon', 'polyester', 'denim', 'wool'],
    'Sweaters':     ['wool', 'acrylic', 'cotton_blend', 'poly_blend'],
    'Sweatshirts':  ['cotton_blend', 'polyester', 'poly_blend'],
    'Dupatta':      ['chiffon', 'silk', 'cotton'],
    # Bottomwear
    'Jeans':        ['denim'],
    'Trousers':     ['cotton', 'cotton_blend', 'polyester', 'linen'],
    'Shorts':       ['cotton', 'denim', 'nylon', 'polyester'],
    'Track Pants':  ['polyester', 'nylon', 'poly_blend'],
    'Leggings':     ['cotton_blend', 'nylon', 'poly_blend'],
    'Capris':       ['cotton', 'denim', 'cotton_blend'],
    'Skirts':       ['cotton', 'denim', 'polyester', 'chiffon'],
    # Dress
    'Dresses':      ['cotton', 'chiffon', 'silk', 'satin', 'polyester'],
    # Innerwear
    'Briefs':       ['cotton', 'cotton_blend'],
    'Bra':          ['cotton_blend', 'nylon', 'polyester'],
    'Innerwear Vests': ['cotton', 'cotton_blend'],
    'Trunk':        ['cotton', 'cotton_blend'],
    # Others
    'Sarees':       ['silk', 'chiffon', 'cotton', 'satin'],
    'Nightdress':   ['cotton', 'satin', 'silk'],
    'Night suits':  ['cotton', 'cotton_blend', 'satin'],
    'Kurta Sets':   ['cotton', 'silk', 'cotton_blend'],
    # Accessories
    'Watches':      ['stainless_steel', 'metal_alloy', 'rubber'],
    'Sunglasses':   ['metal_alloy', 'acrylic', 'stainless_steel'],
    'Handbags':     ['leather', 'faux_leather', 'canvas'],
    'Backpacks':    ['nylon', 'canvas', 'polyester'],
    'Clutches':     ['leather', 'faux_leather', 'satin', 'velvet'],
    'Duffel Bag':   ['nylon', 'canvas', 'polyester'],
    'Wallets':      ['leather', 'faux_leather'],
    'Belts':        ['leather', 'faux_leather'],
    'Socks':        ['cotton', 'cotton_blend', 'nylon'],
    'Earrings':     ['metal_alloy', 'stainless_steel'],
    'Pendant':      ['metal_alloy', 'stainless_steel'],
    'Necklace and Chains': ['metal_alloy', 'stainless_steel'],
    'Ring':         ['metal_alloy', 'stainless_steel'],
    'Ties':         ['silk', 'polyester'],
    'Caps':         ['cotton', 'polyester', 'acrylic'],
    'Scarves':      ['silk', 'wool', 'cotton', 'chiffon'],
    'Stoles':       ['silk', 'wool', 'chiffon'],
    'Cufflinks':    ['stainless_steel', 'metal_alloy'],
    # Footwear
    'Casual Shoes': ['leather', 'canvas', 'faux_leather', 'suede'],
    'Sports Shoes': ['nylon', 'rubber', 'polyester', 'canvas'],
    'Formal Shoes': ['leather', 'faux_leather', 'suede'],
    'Heels':        ['leather', 'faux_leather', 'suede', 'satin'],
    'Flats':        ['leather', 'faux_leather', 'canvas'],
    'Flip Flops':   ['rubber', 'nylon'],
    'Sandals':      ['leather', 'faux_leather', 'rubber'],
}

# Sizes theo loại sản phẩm

# ============================================================
# CATEGORY TRANSLATION MAPS
# ============================================================
MASTER_CAT_VI = {
    'Apparel':        'Quần áo',
    'Accessories':    'Phụ kiện',
    'Footwear':       'Giày dép',
    'Personal Care':  'Chăm sóc cá nhân',
    'Free Items':     'Quà tặng',
}
 
SUB_CAT_VI = {
    'Topwear':                  'Áo trên',
    'Bottomwear':               'Quần',
    'Dress':                    'Váy đầm',
    'Innerwear':                'Đồ lót',
    'Loungewear and Nightwear': 'Đồ mặc nhà & ngủ',
    'Watches':                  'Đồng hồ',
    'Eyewear':                  'Kính',
    'Bags':                     'Túi',
    'Wallets':                  'Ví',
    'Belts':                    'Thắt lưng',
    'Socks':                    'Tất',
    'Jewellery':                'Trang sức',
    'Ties':                     'Cà vạt',
    'Caps':                     'Mũ',
    'Scarves':                  'Khăn',
    'Cufflinks':                'Khuy măng sét',
    'Shoes':                    'Giày',
    'Flip Flops':               'Dép xỏ ngón',
    'Sandals':                  'Sandal',
    'Fragrance':                'Nước hoa',
    'Lips':                     'Son môi',
    'Nail Care':                'Chăm sóc móng',
    'Skin Care':                'Chăm sóc da',
}
 
ARTICLE_TYPE_VI = {
    'Tshirts':               'Áo thun',
    'Shirts':                'Áo sơ mi',
    'Tops':                  'Áo kiểu',
    'Jackets':               'Áo khoác',
    'Sweaters':              'Áo len',
    'Sweatshirts':           'Áo nỉ',
    'Jeans':                 'Quần jeans',
    'Trousers':              'Quần tây',
    'Shorts':                'Quần short',
    'Track Pants':           'Quần thể thao',
    'Leggings':              'Quần legging',
    'Capris':                'Quần lửng',
    'Skirts':                'Váy',
    'Dresses':               'Đầm',
    'Briefs':                'Quần lót',
    'Bra':                   'Áo ngực',
    'Innerwear Vests':       'Áo lót',
    'Trunk':                 'Quần trunk',
    'Nightdress':            'Váy ngủ',
    'Night suits':           'Bộ đồ ngủ',
    'Watches':               'Đồng hồ',
    'Sunglasses':            'Kính râm',
    'Handbags':              'Túi xách tay',
    'Backpacks':             'Ba lô',
    'Clutches':              'Ví cầm tay',
    'Duffel Bag':            'Túi du lịch',
    'Wallets':               'Ví',
    'Belts':                 'Thắt lưng',
    'Socks':                 'Tất',
    'Earrings':              'Hoa tai',
    'Pendant':               'Mặt dây chuyền',
    'Necklace and Chains':   'Dây chuyền',
    'Ring':                  'Nhẫn',
    'Ties':                  'Cà vạt',
    'Caps':                  'Nón',
    'Scarves':               'Khăn choàng',
    'Cufflinks':             'Khuy măng sét',
    'Casual Shoes':          'Giày thường',
    'Sports Shoes':          'Giày thể thao',
    'Formal Shoes':          'Giày tây',
    'Heels':                 'Giày cao gót',
    'Flats':                 'Giày bẹt',
    'Flip Flops':            'Dép xỏ ngón',
    'Sandals':               'Sandal',
}
 
APPAREL_SIZES  = ['S', 'M', 'L', 'XL']
FOOTWEAR_SIZES = ['38', '39', '40', '41', '42', '43']
BELT_SIZES     = ['S', 'M', 'L']
RING_SIZES     = ['6', '7', '8', '9']
 
NO_SIZE_TYPES = {
    'Watches', 'Sunglasses',
    'Handbags', 'Backpacks', 'Clutches', 'Duffel Bag',
    'Wallets',
    'Earrings', 'Pendant', 'Necklace and Chains', 'Ring',
    'Caps', 'Scarves', 'Cufflinks', 'Ties',
}

# ============================================================

def escape_sql(s):
    """Escape chuỗi cho SQL."""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return 'NULL'
    return "'" + str(s).replace("'", "''").replace("\\", "\\\\") + "'"


def map_gender(gender_str):
    """Map gender từ CSV sang TargetGender enum."""
    if not isinstance(gender_str, str):
        return 'UNISEX'
    g = gender_str.strip().lower()
    if g in ('men', 'boys'):
        return 'MALE'
    elif g in ('women', 'girls'):
        return 'FEMALE'
    return 'UNISEX'


def extract_brand(display_name):
    """Trích brand từ productDisplayName."""
    if not isinstance(display_name, str):
        return None

    # Các brand phổ biến (multi-word)
    multi_word_brands = [
        'United Colors of Benetton', 'United Colors Of Benetton',
        'U.S. Polo Assn.', 'U.S. Polo Assn',
        'Peter England', 'John Players', 'John Miller',
        'Allen Solly', 'Flying Machine', 'Mark Taylor',
        'Classic Polo', 'Palm Tree', 'Gini and Jony',
        'French Connection', 'Carlton London', 'Lee Cooper',
        'Mother Earth', 'Reid & Taylor', 'Red Tape', 'Red Chief',
        'Ed Hardy', 'Lino Perros', 'Arrow Woman',
        'Scullers For Her', 'Tokyo Talkies', 'Urban Yoga',
        'Colour me', 'Color me', 'Do U Speak Green', 'Do u speak Green',
        'DC Comics', 'Marvel Comics', 'Mr.Men',
        'Ray-Ban', 'Van Heusen', 'Louis Philippe',
        'Numero Uno', 'Indigo Nation', 'Inc 5', 'Inc.5',
        'David Beckham', 'Sweet Dreams', 'SDL by Sweet Dreams',
        'CASIO G-Shock', 'CASIO EDIFICE', 'CASIO SHEEN', 'CASIO ENTICER',
        'Red Rose', 'Spice Art', 'Royal Diadem',
        'Giorgio Armani', 'Free Authority',
        'Lotus Herbals', 'Lakme', 'Franco Leone',
        'Manchester United', 'Ben 10',
        'Peri Peri', 'ADIDAS Originals', 'Arrow Sport',
        'Indian Terrain', 'Park Avenue', 'Fusion Beats',
        'Global Desi', 'Nike Fragrances',
    ]
    for brand in multi_word_brands:
        if display_name.startswith(brand):
            return brand

    # Fallback: lấy từ đầu tiên
    parts = display_name.split()
    if parts:
        return parts[0]
    return None


COLOR_VI = {
    'Black': 'màu đen', 'White': 'màu trắng', 'Blue': 'màu xanh lam',
    'Red': 'màu đỏ', 'Yellow': 'màu vàng', 'Green': 'màu xanh lá',
    'Purple': 'màu tím', 'Pink': 'màu hồng', 'Orange': 'màu cam',
    'Brown': 'màu nâu', 'Grey': 'màu xám', 'Navy Blue': 'màu xanh navy',
    'Grey Melange': 'màu xám Melange', 'Maroon': 'màu đỏ tươi',
    'Olive': 'màu xanh olive', 'Charcoal': 'màu xám than',
    'Silver': 'màu bạc', 'Gold': 'màu vàng kim', 'Multi': 'đa màu sắc',
    'Copper': 'màu đồng', 'Rose': 'màu hồng dâu', 'Peach': 'màu đào',
    'Beige': 'màu be', 'Cream': 'màu kem', 'Khaki': 'màu kaki',
    'Rust': 'màu gỉ sắt', 'Mustard': 'màu vàng mù tạt',
    'Burgundy': 'màu đỏ rượu vang', 'Magenta': 'màu hồng sậm',
    'Turquoise Blue': 'màu xanh ngọc', 'Navy': 'màu xanh navy',
}

USAGE_STYLE = {
    'Casual':       ('trẻ trung, năng động', 'phù hợp mặc hàng ngày hoặc đi chơi'),
    'Sports':       ('thể thao, thoải mái', 'lý tưởng cho các hoạt động thể thao'),
    'Formal':       ('lịch sự, tinh tế', 'phù hợp đi làm hoặc các dịp trang trọng'),
    'Smart Casual': ('thanh lịch, hiện đại', 'phù hợp đi làm hoặc gặp gỡ bạn bè'),
    'Ethnic':       ('nét truyền thống, độc đáo', 'phù hợp cho các dịp lễ hội'),
    'Travel':       ('thoải mái, tiện lợi', 'lý tưởng cho các chuyến đi du lịch'),
    'Party':        ('nổi bật, cá tính', 'phù hợp cho các buổi tiệc và sự kiện'),
}

SEASON_PHRASE = {
    'Summer': 'thoáng mát cho mùa hè',
    'Winter': 'giữ ấm tốt trong mùa đông',
    'Fall':   'phù hợp tiết trời mùa thu',
    'Spring': 'nhẹ nhàng cho mùa xuân',
}


def generate_description(row):
    """Sinh mô tả sản phẩm tự nhiên, sinh động bằng tiếng Việt."""
    name = row.get('productDisplayName', '')
    if not isinstance(name, str):
        name = f"Sản phẩm {row.get('id', '')}"

    color = row.get('baseColour', '')
    season = row.get('season', '')
    usage = row.get('usage', '')

    color_vi = COLOR_VI.get(color, f'màu {color}') if isinstance(color, str) and color else ''
    style_adj, fit_phrase = USAGE_STYLE.get(usage, ('thời trang', 'phù hợp cho nhiều dịp'))
    season_phrase = SEASON_PHRASE.get(season, '') if isinstance(season, str) else ''

    # Xây dựng câu mô tả tự nhiên
    desc_parts = [name]
    if color_vi:
        desc_parts.append(f'thiết kế {style_adj}')
    else:
        desc_parts.append(f'thiết kế {style_adj}')

    if season_phrase:
        desc_parts.append(season_phrase)

    desc_parts.append(fit_phrase)

    # Ghép thành câu mượt mà
    if color_vi:
        sentence = f'{name} {color_vi}, {", ".join(desc_parts[1:])}.'
    else:
        sentence = f'{name}, {", ".join(desc_parts[1:])}.'

    return sentence


def get_sizes(article_type, master_category):
    """Trả về list sizes phù hợp."""
    if article_type in NO_SIZE_TYPES:
        return ['ONE SIZE']
    if article_type == 'Belts':
        return BELT_SIZES
    if article_type == 'Ring':
        return RING_SIZES
    if article_type == 'Socks':
        return ['FREE']
    if master_category == 'Footwear':
        return FOOTWEAR_SIZES
    return APPAREL_SIZES


def round_price(price):
    """Làm tròn giá đến hàng nghìn."""
    return round(price / 1000) * 1000


def coalesce_text(*values):
    """Lấy chuỗi đầu tiên có giá trị (không rỗng)."""
    for value in values:
        if value is None:
            continue
        if isinstance(value, float) and math.isnan(value):
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def load_styles_data():
    """Đọc file nguồn và lấy tên sản phẩm dịch từ cột dichTen nếu có."""
    df = pd.read_csv(SOURCE_FILE)

    # Chỉ giữ category nằm trong SAMPLE_CONFIG (nếu có)
    sample_config = getattr(sample_2000, 'SAMPLE_CONFIG', None) if sample_2000 else None
    if sample_config:
        allowed_keys = set(sample_config.keys())
        if allowed_keys:
            df['__cat_key__'] = list(zip(df['masterCategory'], df['subCategory'], df['articleType']))
            removed_df = df[~df['__cat_key__'].isin(allowed_keys)]
            if not removed_df.empty:
                removed_keys = sorted(set(removed_df['__cat_key__'].tolist()))
                print(f"Đã loại {len(removed_df)} sản phẩm ngoài SAMPLE_CONFIG ({len(removed_keys)} category).")
                for mc, sc, at in removed_keys:
                    print(f"  - {mc} | {sc} | {at}")
            df = df[df['__cat_key__'].isin(allowed_keys)].drop(columns=['__cat_key__'])

    # Dùng tên dịch từ cột dichTen (nếu thiếu thì fallback về productDisplayName).
    df['productDisplayName_vi'] = df.apply(
        lambda row: coalesce_text(row.get('dichTen'), row.get('productDisplayName')),
        axis=1
    )

    print(f"Đọc được {len(df)} sản phẩm từ {SOURCE_FILE}")
    return df


def main():
    # Đọc file đã dịch thủ công.
    df = load_styles_data()

    images_df = pd.read_csv('images_sampled.csv')
    images_df['id_str'] = images_df['filename'].str.replace('.jpg', '', regex=False).astype(str)
    image_dict = dict(zip(images_df['id_str'], images_df['link']))

    sql_lines = []
    sql_lines.append("-- ============================================================")
    sql_lines.append(f"-- AUTO-GENERATED: Import {len(df)} sản phẩm từ {SOURCE_FILE}")
    sql_lines.append("-- ============================================================")
    sql_lines.append("")

    # ========== 0. MATERIAL DICTIONARY ==========
    sql_lines.append("-- ============================================================")
    sql_lines.append("-- 0. MATERIAL DICTIONARY")
    sql_lines.append("-- ============================================================")

    material_uuid_map = {}  # code -> uuid
    for code, name, quality in MATERIALS:
        mat_uuid = str(uuid.uuid4())
        material_uuid_map[code] = mat_uuid
        sql_lines.append(
            f"INSERT INTO material_dictionary (id, code, name, quality_score, created_at) "
            f"VALUES ({escape_sql(mat_uuid)}, {escape_sql(code)}, {escape_sql(name)}, "
            f"{quality}, NOW());"
        )

    sql_lines.append(f"\n-- Total materials: {len(MATERIALS)}")
    sql_lines.append("")

    # ========== 1. PRODUCT CATEGORIES ==========
    sql_lines.append("-- ============================================================")
    sql_lines.append("-- 1. PRODUCT CATEGORIES")
    sql_lines.append("-- ============================================================")

    # Tạo categories từ tổ hợp (subCategory, articleType) unique
    cat_keys = df[['masterCategory', 'subCategory', 'articleType']].drop_duplicates(
        subset=['masterCategory', 'subCategory', 'articleType']
    )
    category_map = {}  # (subCategory, articleType) -> uuid

    for _, row in cat_keys.iterrows():
        master_cat = str(row['masterCategory'])
        sub_cat = str(row['subCategory'])
        art_type = str(row['articleType'])
        cat_uuid = str(uuid.uuid4())
        code = re.sub(r'[^a-z0-9]', '_', art_type.lower()).strip('_')
        # Đảm bảo code unique bằng cách thêm subcategory nếu trùng
        if code in [v['code'] for v in category_map.values()]:
            code = re.sub(r'[^a-z0-9]', '_', f"{sub_cat}_{art_type}".lower()).strip('_')
        category_map[(master_cat, sub_cat, art_type)] = {'uuid': cat_uuid, 'code': code}

        master_cat_vi = coalesce_text(MASTER_CAT_VI.get(master_cat), master_cat)
        sub_cat_vi = coalesce_text(SUB_CAT_VI.get(sub_cat), sub_cat)
        art_type_vi = coalesce_text(ARTICLE_TYPE_VI.get(art_type), art_type)

        sql_lines.append(
            f"INSERT INTO product_categories (id, master_category, sub_category, article_type, status, created_at) "
            f"VALUES ({escape_sql(cat_uuid)}, {escape_sql(master_cat_vi)}, {escape_sql(sub_cat_vi)}, {escape_sql(art_type_vi)}, true, NOW());"
        )

    sql_lines.append(f"\n-- Total categories: {len(category_map)}")
    sql_lines.append("")

    # ========== 2. PRODUCTS + ATTRIBUTES + VARIANTS ==========
    sql_lines.append("-- ============================================================")
    sql_lines.append("-- 2. PRODUCTS, ATTRIBUTES, VARIANTS")
    sql_lines.append("-- ============================================================")

    total_products = 0
    total_attributes = 0
    total_variants = 0

    for idx, row in df.iterrows():
        product_uuid = str(uuid.uuid4())
        name = coalesce_text(row.get('productDisplayName_vi'), row.get('productDisplayName'))
        if not name:
            name = f"Product {row['id']}"

        original_name = coalesce_text(row.get('productDisplayName'), name)
        if 'brand' in row and pd.notna(row['brand']):
            brand = str(row['brand'])
        else:
            brand = extract_brand(original_name)

        row_for_desc = row.copy()
        row_for_desc['productDisplayName'] = name
        gender = map_gender(row.get('gender', ''))
        description = generate_description(row_for_desc)
        article_type = str(row['articleType'])
        sub_category = str(row['subCategory'])
        master_category = str(row['masterCategory'])

        # Category
        cat_info = category_map.get((master_category, sub_category, article_type))
        if not cat_info:
            continue
        category_uuid = cat_info['uuid']

        # Material
        possible_materials = MATERIAL_MAPPING.get(article_type, ['cotton'])
        chosen_material_code = random.choice(possible_materials)
        material_uuid = material_uuid_map.get(chosen_material_code)

        # Price
        price_range = PRICE_RANGES.get(article_type, DEFAULT_PRICE_RANGE)
        original_price = round_price(random.randint(price_range[0], price_range[1]))
        discount = random.choice([1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7])
        sale_price = round_price(original_price * discount)

        # Sizes & Variants
        sizes = get_sizes(article_type, master_category)
        color = str(row['baseColour']) if isinstance(row['baseColour'], str) else 'Default'

        # Total stock = sum of variant stocks
        variant_stocks = []
        for size in sizes:
            stock = random.randint(5, 50)
            variant_stocks.append(stock)
        total_stock = sum(variant_stocks)

        # Image link
        product_id_str = str(row['id'])
        image_url = image_dict.get(product_id_str)

        # --- INSERT Product ---
        sql_lines.append(f"\n-- Product: {name[:60]}")
        sql_lines.append(
            f"INSERT INTO products (id, name, brand, category_id, material_id, target_gender, "
            f"description, original_price, sale_price, total_stock, status, image_url, created_at, updated_at) "
            f"VALUES ({escape_sql(product_uuid)}, {escape_sql(name[:255])}, {escape_sql(brand[:150] if brand else None)}, "
            f"{escape_sql(category_uuid)}, {escape_sql(material_uuid)}, {escape_sql(gender)}, "
            f"{escape_sql(description)}, {original_price}, {sale_price}, "
            f"{total_stock}, true, {escape_sql(image_url)}, NOW(), NOW());"
        )
        total_products += 1

        # --- INSERT ProductAttributes ---
        attr_data = {
            'season': row.get('season', ''),
            'year': row.get('year', ''),
            'usage': row.get('usage', ''),
            # 'masterCategory': master_category,
            # 'subCategory': sub_category,
            # 'articleType': article_type,
        }
        for key, value in attr_data.items():
            if value and not (isinstance(value, float) and math.isnan(value)):
                attr_uuid = str(uuid.uuid4())
                val_str = str(int(value)) if key == 'year' and isinstance(value, float) else str(value)
                sql_lines.append(
                    f"INSERT INTO product_attributes (id, product_id, attribute_key, attribute_value) "
                    f"VALUES ({escape_sql(attr_uuid)}, {escape_sql(product_uuid)}, "
                    f"{escape_sql(key)}, {escape_sql(val_str)});"
                )
                total_attributes += 1

        # --- INSERT ProductVariants ---
        for i, size in enumerate(sizes):
            variant_uuid = str(uuid.uuid4())
            sku = f"SKU-{row['id']}-{size.replace(' ', '')}"
            v_stock = variant_stocks[i]
            # Variant giá có thể chênh nhẹ theo size
            v_original = original_price
            v_sale = sale_price
            sql_lines.append(
                f"INSERT INTO product_variants (id, product_id, sku, size, color, "
                f"stock_quantity, original_price, sale_price, status, image_url) "
                f"VALUES ({escape_sql(variant_uuid)}, {escape_sql(product_uuid)}, "
                f"{escape_sql(sku[:64])}, {escape_sql(size)}, {escape_sql(color)}, "
                f"{v_stock}, {v_original}, {v_sale}, true, {escape_sql(image_url)});"
            )
            total_variants += 1

    # ========== SUMMARY ==========
    sql_lines.append("")
    sql_lines.append("-- ============================================================")
    sql_lines.append(f"-- SUMMARY:")
    sql_lines.append(f"--   Materials:  {len(MATERIALS)}")
    sql_lines.append(f"--   Categories: {len(category_map)}")
    sql_lines.append(f"--   Products:   {total_products}")
    sql_lines.append(f"--   Attributes: {total_attributes}")
    sql_lines.append(f"--   Variants:   {total_variants}")
    sql_lines.append("-- ============================================================")

    # Lưu file SQL
    output_file = 'import_products.sql'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    total_inserts = len(MATERIALS) + len(category_map) + total_products + total_attributes + total_variants
    print(f"\n{'='*60}")
    print(f"✅ Đã tạo file: {output_file}")
    print(f"   Materials:  {len(MATERIALS)}")
    print(f"   Categories: {len(category_map)}")
    print(f"   Products:   {total_products}")
    print(f"   Attributes: {total_attributes}")
    print(f"   Variants:   {total_variants}")
    print(f"   Tổng số INSERT statements: {total_inserts}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
