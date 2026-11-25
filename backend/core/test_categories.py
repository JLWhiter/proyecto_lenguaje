"""Pruebas unitarias (unittest) de la clave de categorías.

Se pueden ejecutar sin Django: ``python -m unittest core.test_categories``.
"""

import unittest

from core.categories import DEFAULT_CATEGORIES, canonical_category, category_key


class CategoryKeyTests(unittest.TestCase):
    def test_ignores_case_spaces_and_accents(self):
        variants = ("Alimentación", "alimentacion", "ALIMENTACIÓN", "  Alimentacion ", "alimentación")

        self.assertEqual({category_key(name) for name in variants}, {"alimentacion"})

    def test_collapses_inner_spaces(self):
        self.assertEqual(category_key("  Comida   Rápida "), "comida rapida")
        self.assertEqual(category_key("Comida\trápida"), "comida rapida")

    def test_strips_every_combining_mark(self):
        self.assertEqual(category_key("Educación"), category_key("EDUCACION"))
        self.assertEqual(category_key("Pingüino"), "pinguino")
        self.assertEqual(category_key("Año"), "ano")
        self.assertEqual(category_key("Café"), category_key("Café"))  # é compuesta y e + tilde combinable

    def test_compatibility_characters_and_empty_values(self):
        self.assertEqual(category_key("Ｏｔｒｏｓ"), "otros")  # letras de ancho completo (NFKD)
        self.assertEqual(category_key(""), "")
        self.assertEqual(category_key(None), "")

    def test_different_categories_keep_different_keys(self):
        self.assertNotEqual(category_key("Salud"), category_key("Salida"))

    def test_default_categories_have_unique_keys(self):
        self.assertEqual(len({category_key(name) for name in DEFAULT_CATEGORIES}), len(DEFAULT_CATEGORIES))


class CanonicalCategoryTests(unittest.TestCase):
    def test_uses_the_first_known_spelling_with_the_same_key(self):
        known = ["Alimentación", "alimentacion", "Café"]

        self.assertEqual(canonical_category("Alimentacion", known), "Alimentación")
        self.assertEqual(canonical_category("Cafe", known), "Café")

    def test_new_categories_are_kept_as_written(self):
        self.assertEqual(canonical_category("Mascotas", DEFAULT_CATEGORIES), "Mascotas")
        self.assertEqual(canonical_category("Educacion", []), "Educacion")

    def test_defaults_fix_the_accent(self):
        self.assertEqual(canonical_category("Educacion", DEFAULT_CATEGORIES), "Educación")


if __name__ == "__main__":
    unittest.main()
