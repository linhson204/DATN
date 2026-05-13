import pandas as pd

SOURCE_FILE = 'styles_sampled_tieng_viet.csv'
OUTPUT_FILE = 'styles_sampled_vi.csv'

def extract_brand(display_name):
    """Trích brand từ productDisplayName (logic giống generate_sql.py)."""
    if not isinstance(display_name, str):
        return None

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
        'Global Desi', 'Nike Fragrances', 'Status Quo',
    ]
    for brand in multi_word_brands:
        if display_name.startswith(brand):
            return brand

    parts = display_name.split()
    if parts:
        return parts[0]
    return None

def pick_first_non_empty(*values):
    """Lấy giá trị text đầu tiên không rỗng."""
    for value in values:
        if value is None:
            continue
        if isinstance(value, float) and pd.isna(value):
            continue
        text = str(value).strip()
        if text:
            return text
    return None

def main():
    print(f"Reading {SOURCE_FILE}...")
    df = pd.read_csv(SOURCE_FILE)

    translated_cols = [col for col in df.columns if str(col).strip().startswith('Bản dịch')]

    # File dịch tay có 4 cột "Bản dịch": master, sub, article, product name.
    if len(translated_cols) >= 4:
        df['masterCategory'] = df.apply(
            lambda row: pick_first_non_empty(row[translated_cols[0]], row.get('masterCategory')),
            axis=1
        )
        df['subCategory'] = df.apply(
            lambda row: pick_first_non_empty(row[translated_cols[1]], row.get('subCategory')),
            axis=1
        )
        df['articleType'] = df.apply(
            lambda row: pick_first_non_empty(row[translated_cols[2]], row.get('articleType')),
            axis=1
        )

        # Giữ tên gốc để tách brand chuẩn hơn.
        original_name_series = df.get('productDisplayName')
        df['productDisplayName'] = df.apply(
            lambda row: pick_first_non_empty(row[translated_cols[3]], row.get('productDisplayName')),
            axis=1
        )
    else:
        original_name_series = df.get('productDisplayName')

    # Brand luôn tách từ tên gốc (tiếng Anh) nếu có.
    if original_name_series is not None:
        df['brand'] = original_name_series.apply(extract_brand)
    else:
        df['brand'] = df['productDisplayName'].apply(extract_brand)

    # Loại cột dịch phụ trùng tên để file output gọn như trước.
    df = df[[
        'id', 'gender', 'masterCategory', 'subCategory', 'articleType',
        'baseColour', 'season', 'year', 'usage', 'productDisplayName', 'brand'
    ]]

    df.to_csv(OUTPUT_FILE, index=False, encoding='utf-8')
    print(f"Done! Saved {OUTPUT_FILE} ({len(df)} rows).")

if __name__ == "__main__":
    main()
