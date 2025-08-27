.PHONY: migrate test
migrate:
	@echo "Running migrations..."
	@(cd results/scripts && npm install && npm run start)

test:
	@echo "Running tests..."
	@(cd results/tests && npm install && npm run test)