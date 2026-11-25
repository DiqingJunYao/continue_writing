.DEFAULT_GOAL := start

.PHONY: start setup db seed stop-db

start: setup
	npm start

setup: node_modules/.branchline-installed db
	npm run migrate

db: .env
	docker compose up -d --wait db

seed: setup
	npm run seed

stop-db:
	docker compose stop db

.env:
	umask 077 && cp -n .env.example .env

node_modules/.branchline-installed: package.json package-lock.json
	npm ci
	touch $@

down: 
	docker compose down
