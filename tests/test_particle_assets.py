import json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ParticleAssetsTest(unittest.TestCase):
    def test_kenney_particle_pack_manifest_and_pngs(self):
        root=ROOT/"assets"/"effects"/"kenney-particle-pack"
        manifest=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["license"],"CC0-1.0")
        self.assertGreaterEqual(manifest["count"],8)
        for item in manifest["assets"]:
            path=ROOT/item["file"]
            data=path.read_bytes()
            self.assertGreater(len(data),1024,item["file"])
            self.assertEqual(data[:8],bytes([137,80,78,71,13,10,26,10]),item["file"])
        self.assertTrue((root/"LICENSE.txt").is_file())
if __name__=="__main__": unittest.main()
