.PHONY: migrate
migrate:
	@echo "Running migrations..."
	@(cd results/scripts && npm run start)