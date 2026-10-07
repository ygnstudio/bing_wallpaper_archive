import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
spec = importlib.util.spec_from_file_location('download', os.environ.get('BING_DOWNLOAD_TEST_MODULE', 'scripts/download.py'))
download = importlib.util.module_from_spec(spec)
spec.loader.exec_module(download)


def image(day, name):
    return {'fullstartdate': day + '1600', 'startdate': day, 'urlbase': '/th?id=OHR.' + name,
            'title': name, 'url': '/th?id=OHR.' + name + '_1920x1080.jpg'}


class ArchiveDates(unittest.TestCase):
    def test_official_date_is_not_shifted_by_timestamp(self):
        self.assertEqual(download.date_key(image('20261006', 'forest')), '20261006')

    def test_official_date_does_not_require_full_timestamp(self):
        self.assertEqual(download.date_key({'startdate': '20261006'}), '20261006')

    def test_year_end_and_leap_day_keep_source_date(self):
        self.assertEqual(download.date_key(image('20261231', 'a')), '20261231')
        self.assertEqual(download.date_key(image('20240229', 'b')), '20240229')

    def test_missing_or_invalid_date_fails_instead_of_guessing(self):
        for meta in [{}, {'fullstartdate': '202610061600'}, {'startdate': '20260230'}]:
            with self.subTest(meta=meta), self.assertRaises(ValueError):
                download.date_key(meta)


class ArchiveSync(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'data').mkdir()
        self.meta = self.root / 'data/metadata.json'
        self.old = {'20261005': {'title': 'old', 'urlbase': '/th?id=OHR.old',
                                'category': '风景', 'color': '橙', 'uhd': False}}
        self.meta.write_text(json.dumps(self.old))
        self.thumb = self.root / 'thumbnails/2026/10/20261005.webp'
        self.thumb.parent.mkdir(parents=True)
        self.thumb.write_bytes(b'old-photo')

    def sync(self, images):
        def thumbnail(meta, dst):
            dst.write_bytes(meta['title'].encode())
        with patch.object(download, 'download_thumbnail', side_effect=thumbnail), patch.object(download, 'probe_uhd', return_value=True):
            download.sync_wallpapers(images, self.root)

    def test_sync_preserves_dates_photo_labels_and_is_idempotent(self):
        images = [image('20261006', 'new'), image('20261005', 'old')]
        self.sync(images)
        saved = self.meta.read_bytes()
        records = json.loads(saved)
        self.assertEqual(set(records), {'20261005', '20261006'})
        self.assertEqual(records['20261005']['category'], '风景')
        self.assertFalse(records['20261005']['uhd'])
        self.assertEqual(self.thumb.read_bytes(), b'old-photo')
        self.assertEqual((self.thumb.parent / '20261006.webp').read_bytes(), b'new')
        self.assertTrue(self.thumb.exists())
        self.sync(images)
        self.assertEqual(self.meta.read_bytes(), saved)

    def test_failed_download_leaves_archive_unchanged(self):
        saved = self.meta.read_bytes()
        with patch.object(download, 'download_thumbnail', side_effect=OSError('offline')):
            with self.assertRaises(OSError):
                download.sync_wallpapers([image('20261006', 'new'), image('20261005', 'old')], self.root)
        self.assertEqual(self.meta.read_bytes(), saved)
        self.assertEqual(self.thumb.read_bytes(), b'old-photo')

    def test_unrelated_date_collision_does_not_overwrite(self):
        self.old['20261006'] = {'urlbase': '/th?id=OHR.unrelated', 'title': 'unrelated'}
        self.meta.write_text(json.dumps(self.old))
        saved = self.meta.read_bytes()
        with self.assertRaises(ValueError):
            self.sync([image('20261006', 'new')])
        self.assertEqual(self.meta.read_bytes(), saved)

    def test_existing_consecutive_photos_stay_at_original_dates(self):
        self.old['20261006'] = {'urlbase': '/th?id=OHR.new', 'title': 'new', 'uhd': True}
        self.meta.write_text(json.dumps(self.old))
        (self.thumb.parent / '20261006.webp').write_bytes(b'new-photo')
        self.sync([image('20261006', 'new'), image('20261005', 'old')])
        self.assertEqual(self.thumb.read_bytes(), b'old-photo')
        self.assertEqual((self.thumb.parent / '20261006.webp').read_bytes(), b'new-photo')


if __name__ == '__main__':
    unittest.main()
