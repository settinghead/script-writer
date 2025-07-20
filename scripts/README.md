# Database Scripts

## sync-remote-db.sh

Automates the process of syncing your remote database to your local development environment.

### Usage

```bash
# Default usage (connects to xc:6000)
./scripts/sync-remote-db.sh

# Custom remote host and port
./scripts/sync-remote-db.sh my-remote-server 2222
```

### What it does

1. **Dumps remote database** - Creates a clean PostgreSQL dump from the remote server
2. **Stops local containers** - Shuts down and removes local Docker volumes
3. **Starts fresh containers** - Brings up clean database containers
4. **Restores the dump** - Imports all remote data to local database
5. **Verifies the data** - Shows counts of restored records
6. **Cleans up** - Removes temporary dump files

### Requirements

- SSH access to remote server
- Docker and Docker Compose installed locally
- PostgreSQL client tools (psql, pg_dump)
- Remote server must have PostgreSQL running on port 5432

### Configuration

The script uses these default values (edit the script to change them):

- **Database name**: `script_writer`
- **Database user**: `postgres` 
- **Local database**: `localhost:5432`
- **Remote database**: `localhost:5432` (on remote host)

**Note**: Password authentication is handled automatically via `~/.pgpass` file.

### Error handling

The script will exit immediately if any step fails and will clean up temporary files. Each step is clearly marked with colored output for easy debugging.

### Example output

```
🔄 Starting remote database sync process...
Remote: xc:6000
Local: localhost:5432

📦 Step 1: Dumping remote database...
✅ Remote database dumped successfully (8.8M)

🛑 Step 2: Stopping local database containers...
✅ Local containers stopped and volumes removed

🚀 Step 3: Starting fresh database containers...
✅ Fresh containers started

⏳ Step 4: Waiting for database to be ready...
✅ Database is ready

📥 Step 5: Restoring database from dump...
✅ Database restored successfully

🔍 Step 6: Verifying restored data...
📊 Data verification:
  Projects: 17
  Jsondocs: 96
  Transforms: 74
  Users: 3

🧹 Step 7: Cleaning up temporary files...
✅ Temporary dump file removed

🎉 Database sync completed successfully!
Your local database now contains all data from the remote server.
``` 