"""
Script lọc ~2000 sản phẩm từ styles.csv (Apparel + Accessories + Footwear)
và tạo file styles_sampled.csv + images_sampled.csv tương ứng.
"""
import pandas as pd
import os

# ============================================================
# CẤU HÌNH SỐ LƯỢNG MỖI LOẠI SẢN PHẨM
# ============================================================
SAMPLE_CONFIG = {
 
    # ── APPAREL (~1 148) ────────────────────────────────────────────────────
 
    # Topwear (650)
    ('Apparel', 'Topwear', 'Tshirts'):      250,
    ('Apparel', 'Topwear', 'Shirts'):       190,
    ('Apparel', 'Topwear', 'Tops'):         110,
    ('Apparel', 'Topwear', 'Jackets'):       40,
    ('Apparel', 'Topwear', 'Sweaters'):      30,
    ('Apparel', 'Topwear', 'Sweatshirts'):   30,
 
    # Bottomwear (290)
    ('Apparel', 'Bottomwear', 'Jeans'):      85,
    ('Apparel', 'Bottomwear', 'Trousers'):   60,
    ('Apparel', 'Bottomwear', 'Shorts'):     55,
    ('Apparel', 'Bottomwear', 'Track Pants'):40,
    ('Apparel', 'Bottomwear', 'Leggings'):   25,
    ('Apparel', 'Bottomwear', 'Capris'):     10,
    ('Apparel', 'Bottomwear', 'Skirts'):     20,
 
    # Dress (100)
    ('Apparel', 'Dress', 'Dresses'):        100,
 
    # Innerwear (80)
    ('Apparel', 'Innerwear', 'Briefs'):      30,
    ('Apparel', 'Innerwear', 'Bra'):         28,
    ('Apparel', 'Innerwear', 'Innerwear Vests'): 14,
    ('Apparel', 'Innerwear', 'Trunk'):        8,
 
    # Loungewear and Nightwear (32)
    ('Apparel', 'Loungewear and Nightwear', 'Nightdress'):  18,
    ('Apparel', 'Loungewear and Nightwear', 'Night suits'): 14,
 
    # ── ACCESSORIES (~638) ──────────────────────────────────────────────────
    ('Accessories', 'Watches',   'Watches'):            120,
    ('Accessories', 'Eyewear',   'Sunglasses'):          80,
    ('Accessories', 'Bags',      'Handbags'):            100,
    ('Accessories', 'Bags',      'Backpacks'):            55,
    ('Accessories', 'Bags',      'Clutches'):             25,
    ('Accessories', 'Bags',      'Duffel Bag'):           15,
    ('Accessories', 'Wallets',   'Wallets'):              60,
    ('Accessories', 'Belts',     'Belts'):                50,
    ('Accessories', 'Socks',     'Socks'):                55,
    ('Accessories', 'Jewellery', 'Earrings'):             32,
    ('Accessories', 'Jewellery', 'Pendant'):              10,
    ('Accessories', 'Jewellery', 'Necklace and Chains'):  10,
    ('Accessories', 'Jewellery', 'Ring'):                  8,
    ('Accessories', 'Ties',      'Ties'):                 10,
    ('Accessories', 'Caps',      'Caps'):                 22,
    ('Accessories', 'Scarves',   'Scarves'):              14,
    ('Accessories', 'Cufflinks', 'Cufflinks'):             5,
 
    # ── FOOTWEAR (~215) ─────────────────────────────────────────────────────
    ('Footwear', 'Shoes',      'Casual Shoes'):  45,
    ('Footwear', 'Shoes',      'Sports Shoes'):  55,
    ('Footwear', 'Shoes',      'Formal Shoes'):  20,
    ('Footwear', 'Shoes',      'Heels'):         25,
    ('Footwear', 'Shoes',      'Flats'):         20,
    ('Footwear', 'Flip Flops', 'Flip Flops'):    25,
    ('Footwear', 'Sandals',    'Sandals'):        25,
}

RANDOM_SEED = 42

def main():
    # Đọc dữ liệu
    styles = pd.read_csv('styles.csv', on_bad_lines='skip')
    images = pd.read_csv('images.csv', on_bad_lines='skip')

    print(f"Tổng sản phẩm gốc: {len(styles)}")
    print(f"Tổng ảnh gốc: {len(images)}")

    # Lấy mẫu theo cấu hình
    sampled_frames = []
    summary = []

    for (mc, sc, at), n in SAMPLE_CONFIG.items():
        mask = (
            (styles['masterCategory'] == mc) &
            (styles['subCategory'] == sc) &
            (styles['articleType'] == at)
        )
        subset = styles[mask]
        actual_n = min(n, len(subset))
        sample = subset.sample(n=actual_n, random_state=RANDOM_SEED)
        sampled_frames.append(sample)
        summary.append({
            'masterCategory': mc,
            'subCategory': sc,
            'articleType': at,
            'requested': n,
            'available': len(subset),
            'sampled': actual_n,
        })

    # Ghép tất cả mẫu
    styles_sampled = pd.concat(sampled_frames, ignore_index=True)

    # Tạo filename từ id để map với images
    sampled_ids = set(styles_sampled['id'].astype(str))

    # Lọc images: filename có dạng "{id}.jpg"
    images['id_str'] = images['filename'].str.replace('.jpg', '', regex=False)
    images_sampled = images[images['id_str'].isin(sampled_ids)].drop(columns=['id_str'])

    # Lưu file
    styles_sampled.to_csv('styles_sampled.csv', index=False)
    images_sampled.to_csv('images_sampled.csv', index=False)

    # In kết quả
    print(f"\n{'='*60}")
    print(f"KẾT QUẢ LẤY MẪU")
    print(f"{'='*60}")

    summary_df = pd.DataFrame(summary)
    print(summary_df.to_string(index=False))

    print(f"\n{'='*60}")
    print(f"Tổng sản phẩm đã lấy mẫu: {len(styles_sampled)}")
    print(f"Tổng ảnh tương ứng:        {len(images_sampled)}")
    print(f"{'='*60}")

    # Thống kê theo masterCategory
    print(f"\nPhân bổ theo masterCategory:")
    cat_counts = styles_sampled['masterCategory'].value_counts()
    for cat, count in cat_counts.items():
        pct = count / len(styles_sampled) * 100
        print(f"  {cat}: {count} ({pct:.1f}%)")

    print(f"\n✅ Đã lưu: styles_sampled.csv ({len(styles_sampled)} dòng)")
    print(f"✅ Đã lưu: images_sampled.csv ({len(images_sampled)} dòng)")

if __name__ == '__main__':
    main()
