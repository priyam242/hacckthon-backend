#!/usr/bin/env bash
set -euo pipefail

STACK_FOLDER="${1:-}"
NEW_PROJECT_NAME="${2:-}"
ENTITY_NAME="${3:-}"
ENTITY_PLURAL="${4:-${ENTITY_NAME}s}"

if [[ -z "$STACK_FOLDER" || -z "$NEW_PROJECT_NAME" || -z "$ENTITY_NAME" ]]; then
    echo "Usage: ./scripts/new-project.sh <stack-folder> <new-project-name> <EntityName> [plural]"
    exit 1
fi

SOURCE_PATH="stacks/${STACK_FOLDER}"
TARGET_PATH="../${NEW_PROJECT_NAME}"

echo "🚀 Scaffolding new hackathon project: ${NEW_PROJECT_NAME}"
echo "📂 Source: ${SOURCE_PATH}"
echo "🏷️ Renaming entity: Item -> ${ENTITY_NAME}"

mkdir -p "$TARGET_PATH"
cp -R "${SOURCE_PATH}/." "$TARGET_PATH/"

# Clean ignored artifacts
rm -rf "$TARGET_PATH/node_modules" "$TARGET_PATH/dist" "$TARGET_PATH/*.db" "$TARGET_PATH/uploads"

# Generate JWT Secret
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N)

# Replace in files
find "$TARGET_PATH" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.json" -o -name "*.md" -o -name ".env.example" \) -exec sed -i "s/Item/${ENTITY_NAME}/g" {} +
find "$TARGET_PATH" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.json" -o -name "*.md" -o -name ".env.example" \) -exec sed -i "s/item/${ENTITY_NAME,,}/g" {} +
find "$TARGET_PATH" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.json" -o -name "*.md" -o -name ".env.example" \) -exec sed -i "s/items/${ENTITY_PLURAL,,}/g" {} +

if [[ -f "$TARGET_PATH/.env.example" ]]; then
    cp "$TARGET_PATH/.env.example" "$TARGET_PATH/.env"
fi

echo "✅ Project created at ${TARGET_PATH}"
