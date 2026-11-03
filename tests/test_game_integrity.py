#!/usr/bin/env python3
"""Static integrity checks for the Aetheria RPG browser build."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"

class GameMarkupParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canvas_count = 0
        self.script_count = 0
        self.external_script_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "canvas":
            self.canvas_count += 1
        elif tag.lower() == "script":
            self.script_count += 1
            if attrs.get("src"):
                self.external_script_count += 1

class GameIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = HTML.read_text(encoding="utf-8")
        cls.parser = GameMarkupParser()
        cls.parser.feed(cls.source)
        cls.parser.close()

    def test_main_game_entry_exists(self):
        self.assertTrue(HTML.is_file())
        self.assertGreaterEqual(self.parser.canvas_count, 1)

    def test_playable_classes_and_lineage_tree_exist(self):
        for name in ("guerreiro", "mago", "arqueiro", "ladino", "sacerdote"):
            with self.subTest(name=name):
                self.assertIn(name, self.source)
        self.assertIn("INTERLUDE_FIRST", self.source)

    def test_locomotion_animation_pipeline_exists(self):
        self.assertIn("function updatePlayerLocomotion", self.source)
        self.assertIn("function updateExternalFrogAnimation", self.source)
        self.assertIn("requestAnimationFrame", self.source)

    def test_town_services_and_quest_master_exist(self):
        for marker in ("function rpgWorldBuildTown", "function nearestRpgTownNpc",
                       "function useRpgTownNpc", "questmaster",
                       "function rpgQuestState"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_quest_journal_has_progression_and_saved_objectives(self):
        for marker in ("function openRpgQuestJournal", "village_patrol",
                       "town_contacts", "gather_supplies", "cartographer",
                       "rpgQuestProgress('talk'", "rpgQuestProgress('gather'"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_town_wall_collision_and_unique_npc_roles_exist(self):
        for marker in ("const RPG_TOWN_SOLIDS=new Map()", "function rpgTownBlocked",
                       "addSolid(offset,back", "addSolid(side*25,base+61",
                       "npcShaman", "rpgNpcAddRoleProp", "townNpcSkins"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_lineage_weapon_grades_classes_and_visual_models_exist(self):
        for marker in ("const RPG_WEAPON_GRADES=", "const RPG_WEAPON_FAMILIES=",
                       "const RPG_WEAPON_MODELS=", "function rpgWeaponRoll",
                       "function rpgWeaponCanEquip", "function rpgEquipWeaponVisual",
                       "weaponMinLevel", "weaponAllowed", "weaponGrade",
                       "kaykit-fantasy-weapons-bits", "fistweapon_C_right",
                       "bow_C_withString", "staff_D", "level:20", "level:40", "level:52", "level:61", "level:76", "dualSword") :
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)
        self.assertIn("if(i.s===0&&!rpgWeaponCanEquip", self.source)
        self.assertIn("RPG_WEAPON_GRADES[r].id", self.source)

    def test_frontline_classes_receive_matching_offhand_shields(self):
        for marker in ("shieldUsers=['guerreiro','cavaleiro','paladino','templario']",
                       "const shieldByGrade=['shield_A','shield_A','shield_B','shield_B','shield_C','shield_D']",
                       "aetheria-class-shield", "shieldGroup.add(shield)",
                       "weaponMinLevel", "weaponAllowed"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_npc_animation_controller_uses_retargeted_clips(self):
        for marker in ("function rpgNpcSetAnimation", "npc.animClips",
                       "rpgNpcTrigger(npc,'talk')", "RPG_TOWN_NPC_CLIPS[task.key]"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_pbr_texture_pipeline_is_used(self):
        self.assertIn("function rpgPbrTexture", self.source)
        self.assertGreaterEqual(self.source.count("rpgPbrTexture("), 30)

    def test_town_npcs_use_imported_rigged_skins(self):
        for marker in ("rpgWorldLoad('npcKnight'", "rpgWorldLoad('npcMage'",
                       "rpgWorldLoad('npcRogue'", "T.SkeletonUtils.clone(source)",
                       "function updateRpgTownNpcAnimations"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_mobile_memory_guard_cannot_be_overridden_by_hd_toggle(self):
        for marker in ("const LOW_MEM=!!(", "q=LOW_MEM?'l':requested",
                       "const shadows=!LOW_MEM&&!!p[1]",
                       "Prévia 3D desativada no modo leve"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_dungeon_and_reward_systems_exist(self):
        for marker in ("function spawnRpgDungeonChests", "RPG_DUNGEON.rewards",
                       "function clearRpgDungeonRewards"):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.source)

    def test_no_conflicting_legacy_title(self):
        self.assertNotIn("Suba o Rio", self.source)

    def test_html_document_is_well_formed_enough_to_parse(self):
        self.assertEqual(self.source.lower().count("</html>"), 1)
        self.assertTrue(self.source.rstrip().lower().endswith("</html>"))
        self.assertGreater(self.parser.script_count, 0)

if __name__ == "__main__":
    unittest.main(verbosity=2)
