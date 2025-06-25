#!/bin/bash

# Database Backup Script for Moov Property Search
set -e

# Configuration
BACKUP_DIR="/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log "Created backup directory: $BACKUP_DIR"
    fi
}

# Database backup
backup_database() {
    log "Starting database backup..."
    
    local backup_file="$BACKUP_DIR/postgres_backup_$TIMESTAMP.sql"
    local compressed_file="$backup_file.gz"
    
    # Create database dump
    pg_dump -h ${POSTGRES_HOST:-postgres} \
            -U ${POSTGRES_USER} \
            -d ${POSTGRES_DB} \
            --verbose \
            --no-password \
            --format=custom \
            --compress=9 \
            > "$backup_file"
    
    # Compress the backup
    gzip "$backup_file"
    
    # Verify backup integrity
    if [ -f "$compressed_file" ] && [ -s "$compressed_file" ]; then
        local file_size=$(du -h "$compressed_file" | cut -f1)
        success "Database backup completed: $compressed_file ($file_size)"
        
        # Test backup integrity
        gunzip -t "$compressed_file"
        if [ $? -eq 0 ]; then
            success "Backup integrity verified"
        else
            error "Backup integrity check failed"
            return 1
        fi
    else
        error "Database backup failed"
        return 1
    fi
}

# Redis backup
backup_redis() {
    log "Starting Redis backup..."
    
    local backup_file="$BACKUP_DIR/redis_backup_$TIMESTAMP.rdb"
    
    # Create Redis dump
    redis-cli -h ${REDIS_HOST:-redis-master} \
              -p ${REDIS_PORT:-6379} \
              --rdb "$backup_file"
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        # Compress Redis backup
        gzip "$backup_file"
        local file_size=$(du -h "$backup_file.gz" | cut -f1)
        success "Redis backup completed: $backup_file.gz ($file_size)"
    else
        error "Redis backup failed"
        return 1
    fi
}

# Application data backup
backup_application_data() {
    log "Starting application data backup..."
    
    local backup_file="$BACKUP_DIR/app_data_backup_$TIMESTAMP.tar.gz"
    
    # Backup application logs and configuration
    tar -czf "$backup_file" \
        /var/log/moov/ \
        /opt/moov/config/ \
        /opt/moov/uploads/ \
        2>/dev/null || true
    
    if [ -f "$backup_file" ]; then
        local file_size=$(du -h "$backup_file" | cut -f1)
        success "Application data backup completed: $backup_file ($file_size)"
    else
        warning "Application data backup had no files to backup"
    fi
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    if [ -n "$AWS_S3_BUCKET" ]; then
        log "Uploading backups to S3..."
        
        aws s3 sync "$BACKUP_DIR" "s3://$AWS_S3_BUCKET/backups/$(date +%Y/%m/%d)/" \
            --exclude "*" \
            --include "*_$TIMESTAMP.*" \
            --storage-class STANDARD_IA
        
        if [ $? -eq 0 ]; then
            success "Backups uploaded to S3"
        else
            error "Failed to upload backups to S3"
        fi
    fi
    
    if [ -n "$GCS_BUCKET" ]; then
        log "Uploading backups to Google Cloud Storage..."
        
        gsutil -m cp "$BACKUP_DIR/*_$TIMESTAMP.*" \
            "gs://$GCS_BUCKET/backups/$(date +%Y/%m/%d)/"
        
        if [ $? -eq 0 ]; then
            success "Backups uploaded to GCS"
        else
            error "Failed to upload backups to GCS"
        fi
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    # Count remaining backups
    local remaining_count=$(find "$BACKUP_DIR" -name "*backup*" | wc -l)
    
    success "Cleanup completed. $remaining_count backup files remaining"
}

# Send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        local emoji=":white_check_mark:"
        
        if [ "$status" != "success" ]; then
            color="danger"
            emoji=":x:"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Moov Backup Status\",
                    \"text\": \"$message\",
                    \"footer\": \"Moov Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "Moov Backup Status - $status" "$EMAIL_RECIPIENT"
    fi
}

# Health check
health_check() {
    log "Performing backup health check..."
    
    local latest_db_backup=$(find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    local latest_redis_backup=$(find "$BACKUP_DIR" -name "redis_backup_*.rdb.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -n "$latest_db_backup" ] && [ -n "$latest_redis_backup" ]; then
        local db_age=$(( ($(date +%s) - $(stat -c %Y "$latest_db_backup")) / 86400 ))
        local redis_age=$(( ($(date +%s) - $(stat -c %Y "$latest_redis_backup")) / 86400 ))
        
        if [ $db_age -le 1 ] && [ $redis_age -le 1 ]; then
            success "Backup health check passed"
            return 0
        else
            warning "Backup health check: backups are older than 24 hours"
            return 1
        fi
    else
        error "Backup health check failed: missing backup files"
        return 1
    fi
}

# Main backup function
main() {
    log "Starting backup process..."
    
    local start_time=$(date +%s)
    local success_count=0
    local total_operations=4
    
    create_backup_dir
    
    # Perform backups
    if backup_database; then
        ((success_count++))
    fi
    
    if backup_redis; then
        ((success_count++))
    fi
    
    if backup_application_data; then
        ((success_count++))
    fi
    
    upload_to_cloud
    cleanup_old_backups
    
    if health_check; then
        ((success_count++))
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $success_count -eq $total_operations ]; then
        local message="Backup completed successfully in ${duration}s. All $total_operations operations succeeded."
        success "$message"
        send_notification "success" "$message"
    else
        local message="Backup completed with issues in ${duration}s. $success_count/$total_operations operations succeeded."
        warning "$message"
        send_notification "warning" "$message"
    fi
}

# Run main function
main "$@"