.PHONY: migrate
migrate:
	@echo "Running migrations..."
	@(cd results/scripts && npm install && npm run start)