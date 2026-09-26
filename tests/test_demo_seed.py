import os
import unittest

os.environ.setdefault("ECOMMERCE_DATABASE_URL", "sqlite:///:memory:")

from sqlalchemy import create_engine, func, select
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateTable

from database.tables import base, faq, orders, products, products_variants
from scripts.seed_demo import seed_demo_data


class DemoSeedTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

    def tearDown(self):
        self.engine.dispose()

    def test_schema_can_be_created_on_mysql(self):
        statements = "\n".join(
            str(CreateTable(table).compile(dialect=mysql.dialect()))
            for table in base.metadata.sorted_tables
        )
        self.assertIn("color VARCHAR(20)", statements)
        self.assertIn("question VARCHAR(500)", statements)
        self.assertIn("answer VARCHAR(500)", statements)

    def test_seed_creates_demo_catalog_faq_and_orders_once(self):
        self.assertTrue(seed_demo_data(self.engine))
        self.assertFalse(seed_demo_data(self.engine))

        with self.engine.connect() as conn:
            self.assertEqual(conn.scalar(select(func.count()).select_from(products)), 4)
            self.assertEqual(conn.scalar(select(func.count()).select_from(products_variants)), 6)
            self.assertEqual(conn.scalar(select(func.count()).select_from(faq)), 4)
            self.assertEqual(conn.scalar(select(func.count()).select_from(orders)), 2)
            self.assertEqual(
                conn.scalar(select(products_variants.color).limit(1)), "black"
            )

    def test_seed_does_not_modify_existing_catalog(self):
        base.metadata.create_all(self.engine)
        with self.engine.begin() as conn:
            conn.execute(
                products.__table__.insert(),
                {
                    "sku": "EXIST-001",
                    "name": "Existing item",
                    "category": "bags",
                    "base_price": 20,
                    "active": "TRUE",
                },
            )

        self.assertFalse(seed_demo_data(self.engine))
        with self.engine.connect() as conn:
            self.assertEqual(conn.scalar(select(func.count()).select_from(products)), 1)
            self.assertEqual(conn.scalar(select(func.count()).select_from(orders)), 0)


if __name__ == "__main__":
    unittest.main()
