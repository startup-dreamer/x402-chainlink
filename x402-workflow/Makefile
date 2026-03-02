.PHONY: build clean

WASM_DIR := wasm
WASM_OUTPUT := $(WASM_DIR)/workflow.wasm
COMPILED_WASM := compiled-workflow.wasm

# Build target: use pre-compiled WASM (compiled from TypeScript via @chainlink/cre-sdk + Javy)
build:
	@mkdir -p $(WASM_DIR)
	@if [ -f $(COMPILED_WASM) ]; then \
		cp $(COMPILED_WASM) $(WASM_OUTPUT); \
		echo "✅ Workflow ready: $(WASM_OUTPUT)"; \
	else \
		echo "❌ $(COMPILED_WASM) not found. Cannot build workflow."; \
		exit 1; \
	fi

clean:
	rm -rf $(WASM_DIR)
