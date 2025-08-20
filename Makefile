.PHONY: migrate
migrate:
	@echo "Inserting files into the database..."
	@docker compose up -d
	@cd results/scripts && \
	npm install && \
	npm run migrate