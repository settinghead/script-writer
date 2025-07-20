#!/bin/bash

# Script to sync remote database to local
# Usage: ./scripts/sync-remote-db.sh [remote_host] [remote_port]
# Default: ./scripts/sync-remote-db.sh xc 6000

set -e  # Exit on any error

# Configuration
REMOTE_HOST=${1:-xc}
REMOTE_PORT=${2:-6000}
DB_NAME="script_writer"
DB_USER="postgres"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="5432"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting remote database sync process...${NC}"
echo -e "${YELLOW}Remote: ${REMOTE_HOST}:${REMOTE_PORT}${NC}"
echo -e "${YELLOW}Local: ${LOCAL_DB_HOST}:${LOCAL_DB_PORT}${NC}"
echo

# Step 1: Create dump from remote database
echo -e "${BLUE}📦 Step 1: Dumping remote database...${NC}"
DUMP_FILE="remote_db_dump_$(date +%Y%m%d_%H%M%S).sql"

ssh -p ${REMOTE_PORT} ${REMOTE_HOST} "pg_dump -h localhost -p 5432 -U ${DB_USER} -d ${DB_NAME} --clean --if-exists --no-owner --no-privileges" > ${DUMP_FILE}

if [ $? -eq 0 ]; then
    DUMP_SIZE=$(ls -lh ${DUMP_FILE} | awk '{print $5}')
    echo -e "${GREEN}✅ Remote database dumped successfully (${DUMP_SIZE})${NC}"
else
    echo -e "${RED}❌ Failed to dump remote database${NC}"
    exit 1
fi

# Step 2: Stop local containers and remove volumes
echo -e "${BLUE}🛑 Step 2: Stopping local database containers...${NC}"
docker compose down -v
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Local containers stopped and volumes removed${NC}"
else
    echo -e "${RED}❌ Failed to stop local containers${NC}"
    rm ${DUMP_FILE}
    exit 1
fi

# Step 3: Start fresh containers
echo -e "${BLUE}🚀 Step 3: Starting fresh database containers...${NC}"
docker compose up -d
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Fresh containers started${NC}"
else
    echo -e "${RED}❌ Failed to start containers${NC}"
    rm ${DUMP_FILE}
    exit 1
fi

# Step 4: Wait for database to be ready
echo -e "${BLUE}⏳ Step 4: Waiting for database to be ready...${NC}"
sleep 10

# Check if database is ready
for i in {1..30}; do
    if psql -h ${LOCAL_DB_HOST} -p ${LOCAL_DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database failed to start after 5 minutes${NC}"
        rm ${DUMP_FILE}
        exit 1
    fi
    echo -e "${YELLOW}⏳ Waiting for database... (${i}/30)${NC}"
    sleep 10
done

# Step 5: Restore the dump
echo -e "${BLUE}📥 Step 5: Restoring database from dump...${NC}"
psql -h ${LOCAL_DB_HOST} -p ${LOCAL_DB_PORT} -U ${DB_USER} -d ${DB_NAME} < ${DUMP_FILE}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restored successfully${NC}"
else
    echo -e "${RED}❌ Failed to restore database${NC}"
    rm ${DUMP_FILE}
    exit 1
fi

# Step 6: Verify the restore
echo -e "${BLUE}🔍 Step 6: Verifying restored data...${NC}"
VERIFICATION=$(psql -h ${LOCAL_DB_HOST} -p ${LOCAL_DB_PORT} -U ${DB_USER} -d ${DB_NAME} -t -c "
SELECT 
    'Projects: ' || COUNT(*) FROM projects
UNION ALL
SELECT 
    'Jsondocs: ' || COUNT(*) FROM jsondocs  
UNION ALL
SELECT 
    'Transforms: ' || COUNT(*) FROM transforms
UNION ALL
SELECT 
    'Users: ' || COUNT(*) FROM users;
")

echo -e "${GREEN}📊 Data verification:${NC}"
echo "${VERIFICATION}" | sed 's/^/  /'

# Step 7: Cleanup
echo -e "${BLUE}🧹 Step 7: Cleaning up temporary files...${NC}"
rm ${DUMP_FILE}
echo -e "${GREEN}✅ Temporary dump file removed${NC}"

echo
echo -e "${GREEN}🎉 Database sync completed successfully!${NC}"
echo -e "${BLUE}Your local database now contains all data from the remote server.${NC}" 