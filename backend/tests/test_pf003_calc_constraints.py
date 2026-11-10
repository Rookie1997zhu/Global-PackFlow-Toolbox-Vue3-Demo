"""PF-003 — per-SKU allowRotate/stackable must survive into engine payload (expected red)."""

from __future__ import annotations

from django.test import TestCase

from apps.calculations.adapters import build_engine_payload, cargo_to_skus, input_hash


class Pf003CalcConstraintTests(TestCase):
    def test_per_sku_constraints_in_engine_payload(self) -> None:
        cargo = [
            {
                "sku": "SKU-A",
                "length": 42,
                "width": 32,
                "height": 28,
                "weight": 7.5,
                "qty": 2,
                "price": 12.5,
                "allowRotate": False,
                "stackable": False,
            },
            {
                "sku": "SKU-B",
                "length": 36,
                "width": 28,
                "height": 22,
                "weight": 5.2,
                "qty": 2,
                "price": 8.0,
                "allowRotate": True,
                "stackable": True,
            },
        ]
        params = {
            "containerPreset": "40HQ",
            "allowRotate": True,
            "skus": [
                {"id": "SKU-A", "allowRotate": False, "stackable": False},
                {"id": "SKU-B", "allowRotate": True, "stackable": True},
            ],
        }
        payload = build_engine_payload(cargo, params)
        skus = payload["skus"]
        by_id = {s["id"]: s for s in skus}
        self.assertEqual(len(skus), 2)
        self.assertIs(by_id["SKU-A"]["allowRotate"], False)
        self.assertIs(by_id["SKU-A"]["stackable"], False)
        self.assertIs(by_id["SKU-B"]["allowRotate"], True)
        self.assertIs(by_id["SKU-B"]["stackable"], True)
        # Must not force every SKU to global allowRotate / stackable True
        self.assertFalse(all(s["stackable"] is True for s in skus))
        self.assertFalse(all(s["allowRotate"] is True for s in skus))

        h1 = input_hash(payload)
        cargo2 = [dict(cargo[0]), dict(cargo[1])]
        cargo2[0]["stackable"] = True
        payload2 = build_engine_payload(cargo2, params)
        # If adapters ignore per-SKU stackable, hashes collide — that is the bug.
        self.assertNotEqual(h1, input_hash(payload2))

    def test_cargo_to_skus_reads_row_level_flags(self) -> None:
        skus = cargo_to_skus(
            [
                {
                    "sku": "A",
                    "length": 40,
                    "width": 30,
                    "height": 20,
                    "weight": 1,
                    "qty": 1,
                    "allowRotate": False,
                    "stackable": False,
                }
            ],
            allow_rotate=True,
        )
        self.assertIs(skus[0]["allowRotate"], False)
        self.assertIs(skus[0]["stackable"], False)
