.PHONY: help download classify detect generate validate build dev clean

help:
	@echo "可用命令:"
	@echo "  make download   - 下载当日 Bing 壁纸并生成缩略图"
	@echo "  make classify   - 对未分类图片执行 VLM 分类"
	@echo "  make detect     - 探测未标注图片的 4K 可用性"
	@echo "  make generate   - 根据 metadata.json 生成 index.json"
	@echo "  make validate   - 校验 metadata.json 与 index.json"
	@echo "  make build      - 构建前端站点到 dist/"
	@echo "  make dev        - 本地开发构建（不压缩）"
	@echo "  make all        - 完整流程：download → classify → detect → generate → validate → build"
	@echo "  make clean      - 清理 dist/ 与构建产物"

download:
	python3 scripts/download.py

classify:
	python3 scripts/vlm_classify.py

detect:
	python3 scripts/detect_uhd.py

generate:
	python3 scripts/generate_index.py

validate:
	python3 scripts/validate.py

build:
	npm run build

dev:
	npm run dev

all: download classify detect generate validate build

clean:
	rm -rf dist _site
