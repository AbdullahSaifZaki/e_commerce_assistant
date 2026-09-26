"""Create a small, synthetic catalog in an empty e-commerce database.

Run with ``python -m database.seed_demo`` after setting ECOMMERCE_DATABASE_URL.
Existing application data is left untouched.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from database.tables import base, engine, faq, orders, products, products_variants


def seed_demo_data(target_engine):
    base.metadata.create_all(target_engine)

    with target_engine.begin() as conn:
        tables = (products, products_variants, faq, orders)
        if any(conn.scalar(select(func.count()).select_from(table)) for table in tables):
            return False

        conn.execute(
            products.__table__.insert(),
            [
                {"sku": "DEMO-001", "name": "City Runner Shoes", "category": "shoes", "brand": "Aisle", "description": "Lightweight everyday running shoes", "gender": "unisex", "base_price": 79.00, "rating": 4.6, "review_count": 18, "active": "TRUE"},
                {"sku": "DEMO-002", "name": "Everyday Hoodie", "category": "hoodies", "brand": "Aisle", "description": "Soft cotton hoodie for casual wear", "gender": "unisex", "base_price": 55.00, "rating": 4.8, "review_count": 24, "active": "TRUE"},
                {"sku": "DEMO-003", "name": "Canvas Tote Bag", "category": "bags", "brand": "Aisle", "description": "Reusable canvas tote with a roomy interior", "gender": "unisex", "base_price": 25.00, "rating": 4.4, "review_count": 11, "active": "TRUE"},
                {"sku": "DEMO-004", "name": "Denim Jacket", "category": "jackets", "brand": "Aisle", "description": "Classic midweight denim jacket", "gender": "unisex", "base_price": 95.00, "rating": 4.7, "review_count": 15, "active": "TRUE"},
            ],
        )
        product_ids = dict(conn.execute(select(products.sku, products.product_id)).all())
        conn.execute(
            products_variants.__table__.insert(),
            [
                {"product_id": product_ids["DEMO-001"], "sku": "DEMO-001-BLK-42", "color": "black", "size": "42", "price": 79.00, "stock_quantity": 12, "active": "TRUE"},
                {"product_id": product_ids["DEMO-001"], "sku": "DEMO-001-WHT-43", "color": "white", "size": "43", "price": 79.00, "stock_quantity": 9, "active": "TRUE"},
                {"product_id": product_ids["DEMO-002"], "sku": "DEMO-002-BLK-M", "color": "black", "size": "M", "price": 55.00, "stock_quantity": 16, "active": "TRUE"},
                {"product_id": product_ids["DEMO-002"], "sku": "DEMO-002-GRY-L", "color": "gray", "size": "L", "price": 55.00, "stock_quantity": 14, "active": "TRUE"},
                {"product_id": product_ids["DEMO-003"], "sku": "DEMO-003-NAT-OS", "color": "natural", "size": "OS", "price": 25.00, "stock_quantity": 25, "active": "TRUE"},
                {"product_id": product_ids["DEMO-004"], "sku": "DEMO-004-BLU-M", "color": "blue", "size": "M", "price": 95.00, "stock_quantity": 8, "active": "TRUE"},
            ],
        )
        conn.execute(
            faq.__table__.insert(),
            [
                {"question": "How long does shipping take?", "answer": "Standard shipping usually takes 3 to 5 business days. This is demo information."},
                {"question": "Can I return an item?", "answer": "Demo returns are accepted within 30 days if the item is unused."},
                {"question": "How do I track my order?", "answer": "Ask the assistant about demo order 900001 or 900002."},
                {"question": "Which payment methods are accepted?", "answer": "This demo does not process payments or place real orders."},
            ],
        )
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        conn.execute(
            orders.__table__.insert(),
            [
                {"order_id": 900001, "customer_id": 1, "status": "shipped", "total_price": 79.00, "created_at": now - timedelta(days=4), "shipped_at": now - timedelta(days=2), "delivered_at": None, "tracking_number": "DEMO-TRACK-001", "carrier": "Demo Carrier"},
                {"order_id": 900002, "customer_id": 2, "status": "processing", "total_price": 55.00, "created_at": now - timedelta(days=1), "shipped_at": None, "delivered_at": None, "tracking_number": None, "carrier": None},
            ],
        )
    return True


if __name__ == "__main__":
    if seed_demo_data(engine):
        print("Created demo tables and synthetic data.")
    else:
        print("Database already contains data; no demo records were added.")
