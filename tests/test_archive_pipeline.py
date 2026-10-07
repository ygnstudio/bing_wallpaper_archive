import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import download
import lib
from test_download import image


class Polling(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'data').mkdir()
        self.meta = self.root / 'data/metadata.json'
        lib.save_json(self.meta, {'20261005': {'title': 'old', 'urlbase': '/th?id=OHR.old'}})
        self.thumb = download.thumbnail_path(self.root, '20261005')
        self.thumb.parent.mkdir(parents=True)
        self.thumb.write_bytes(b'photo')

    def test_no_change_skips_work_and_preserves_first_seen(self):
        before = self.meta.read_bytes()
        report = download.inspect_archive([image('20261005', 'old')], self.root, '2026-10-07T00:37:00+00:00')
        self.assertEqual(report['processing_dates'], [])
        self.assertEqual(self.meta.read_bytes(), before)
        download.record_observations(report, self.root)
        later = download.inspect_archive([image('20261005', 'old')], self.root, '2026-10-07T04:37:00+00:00')
        self.assertEqual(later['observations'][0]['first_seen_at'], report['checked_at'])
        self.assertTrue(later['observations'][0]['already_archived_at_first_seen'])
        self.assertNotEqual(later['checked_at'], report['checked_at'])

    def test_all_new_dates_and_older_missing_photo_are_scheduled(self):
        self.thumb.unlink()
        report = download.inspect_archive([image('20261006', 'new'), image('20261007', 'next')], self.root)
        self.assertEqual(report['new_dates'], ['20261006', '20261007'])
        self.assertEqual(report['repair_dates'], ['20261005'])
        self.assertEqual([m['startdate'] for m in report['images']], ['20261005', '20261006', '20261007'])
        self.assertFalse(report['observations'][0]['already_archived_at_first_seen'])

    def test_zero_byte_thumbnail_is_scheduled(self):
        self.thumb.write_bytes(b'')
        report = download.inspect_archive([image('20261005', 'old')], self.root)
        self.assertEqual(report['repair_dates'], ['20261005'])
        self.assertEqual(report['new_dates'], [])

    def test_report_gates_new_photos_separately_from_repairs(self):
        self.thumb.unlink()
        report = download.inspect_archive([image('20261005', 'old')], self.root)
        output = self.root / 'output'
        with patch.dict('os.environ', {'GITHUB_OUTPUT': str(output), 'GITHUB_STEP_SUMMARY': ''}):
            download.write_report(report, self.root / 'report.json')
        self.assertEqual(output.read_text(), 'needs_work=true\nhas_new=false\n')

    def test_report_gates_no_change_and_all_new_photos(self):
        for images, expected in [([image('20261005', 'old')], 'needs_work=false\nhas_new=false\n'),
                                 ([image('20261006', 'new')], 'needs_work=true\nhas_new=true\n')]:
            report = download.inspect_archive(images, self.root)
            output = self.root / 'gate-output'
            output.write_text('')
            with patch.dict('os.environ', {'GITHUB_OUTPUT': str(output), 'GITHUB_STEP_SUMMARY': ''}):
                download.write_report(report, self.root / 'report.json')
            self.assertEqual(output.read_text(), expected)

    def test_source_date_collision_fails_before_observations_change(self):
        with self.assertRaises(ValueError):
            download.inspect_archive([image('20261005', 'different')], self.root)
        self.assertFalse((self.root / 'data/first-seen.json').exists())


class Retry(unittest.TestCase):
    def test_network_recovers_on_third_attempt(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'photo'
        with patch.object(lib.urllib.request, 'urlopen', side_effect=[OSError('timeout'), OSError('timeout'), response]) as fetch, patch.object(lib.time, 'sleep'):
            self.assertEqual(lib.http_get('https://example.com/photo'), b'photo')
            self.assertEqual(fetch.call_count, 3)

    def test_retry_exhaustion_raises(self):
        with patch.object(lib.urllib.request, 'urlopen', side_effect=OSError('offline')) as fetch, patch.object(lib.time, 'sleep'):
            with self.assertRaises(OSError):
                download.fetch_metadata()
            self.assertEqual(fetch.call_count, 3)

    def test_thumbnail_download_uses_retry_transport(self):
        with patch.object(download, 'http_get', return_value=b'bytes') as fetch, patch.object(download, 'make_thumbnail') as make:
            download.download_thumbnail(image('20261006', 'new'), Path('output.webp'))
        fetch.assert_called_once()
        make.assert_called_once_with(b'bytes', Path('output.webp'))


class Validation(unittest.TestCase):
    def test_null_missing_empty_and_missing_date_fail_valid_file_passes(self):
        script = Path(os.environ.get('ARCHIVE_VALIDATOR_TEST_MODULE', Path(__file__).resolve().parents[1] / 'scripts/check_archive.py'))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'ok.webp').write_bytes(b'photo')
            (root / 'empty.webp').write_bytes(b'')
            cases = [({'date': '20261006', 'thumbnail': 'ok.webp'}, 0),
                     ({'date': '20261006', 'thumbnail': None}, 1),
                     ({'date': '20261006'}, 1),
                     ({'date': '20261006', 'thumbnail': 'absent.webp'}, 1),
                     ({'date': '20261006', 'thumbnail': 'empty.webp'}, 1),
                     ({'thumbnail': 'ok.webp'}, 1)]
            for item, code in cases:
                with self.subTest(item=item):
                    lib.save_json(root / 'index.json', [item])
                    result = subprocess.run([sys.executable, str(script), '--root', directory, '--index', 'index.json'], capture_output=True)
                    self.assertEqual(result.returncode, code)


class Classification(unittest.TestCase):
    def test_model_loads_once_and_processes_every_new_date_only(self):
        # Avoid importing Pillow or a model runtime: test the CLI orchestration itself.
        classify = types.ModuleType('classify')
        classify.CATEGORY_RES = []
        classify.search_term = lambda value: value
        spec = importlib.util.spec_from_file_location('vlm_under_test', Path(__file__).resolve().parents[1] / 'scripts/vlm_classify.py')
        vlm = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'classify': classify}):
            spec.loader.exec_module(vlm)
        meta = {date: {'title': date, 'category': '其他'} for date in ['20261005', '20261006', '20261007']}
        def load(path):
            return {'new_dates': ['20261006', '20261007']} if path == 'report.json' else meta
        from unittest.mock import MagicMock
        classifier = MagicMock(return_value='植物')
        with patch.object(vlm, 'load_json', side_effect=load), patch.object(vlm, 'save_json'), patch.object(vlm, 'load_model', return_value=('model', 'processor')) as model, patch.object(vlm, 'build_classifier', return_value=classifier), patch.object(vlm.os.path, 'exists', return_value=True), patch.object(sys, 'argv', ['vlm', '--dates-file', 'report.json']):
            vlm.main()
        model.assert_called_once()
        self.assertEqual([call.args[1] for call in classifier.call_args_list], ['20261006', '20261007'])
        self.assertEqual(meta['20261005']['category'], '其他')


if __name__ == '__main__':
    unittest.main()
