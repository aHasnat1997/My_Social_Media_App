import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutBucketPolicyCommand,
  CreateBucketCommand,
  ListBucketsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { lookup } from "mime-types";

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly mediaEndpoint = process.env.S3_ENDPOINT;
  private readonly accessKeyId = process.env.S3_ACCESS_KEY_ID as string;
  private readonly secretAccessKey = process.env.S3_SECRET_ACCESS_KEY as string;
  private readonly region = process.env.S3_REGION as string;

  // File type categorization
  private readonly imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
    ".ico",
  ];

  private readonly videoExtensions = [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".mkv",
    ".webm",
    ".m4v",
    ".mpg",
    ".mpeg",
  ];

  constructor() {
    // Sanitize bucket name: replace underscores with hyphens and convert to lowercase
    const rawBucketName = process.env.S3_BUCKET_NAME as string;

    if (!rawBucketName) {
      throw new Error("S3_BUCKET_NAME environment variable is required");
    }

    this.bucketName = this.sanitizeBucketName(rawBucketName);

    if (rawBucketName !== this.bucketName) {
      this.logger.warn(`Bucket name sanitized from "${rawBucketName}" to "${this.bucketName}"`);
    }

    this.logger.log(`🔧 Initializing S3 Client with endpoint: ${this.mediaEndpoint}`);
    this.logger.log(`🪣 Target bucket name: "${this.bucketName}"`);

    this.s3Client = new S3Client({
      endpoint: this.mediaEndpoint,
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      forcePathStyle: true, // Critical for MinIO/RustFS
    });
  }

  /**
   * Sanitize bucket name to comply with S3/MinIO naming rules
   */
  private sanitizeBucketName(name: string): string {
    return name
      .toLowerCase() // Convert to lowercase
      .replace(/_/g, "-") // Replace underscores with hyphens
      .replace(/[^a-z0-9.-]/g, "") // Remove invalid characters
      .replace(/^[.-]+|[.-]+$/g, "") // Remove leading/trailing dots or hyphens
      .replace(/\.{2,}/g, ".") // Replace consecutive dots with single dot
      .replace(/-{2,}/g, "-") // Replace consecutive hyphens with single hyphen
      .slice(0, 63); // Ensure max 63 characters
  }

  // This will run when the module initializes
  async onModuleInit() {
    try {
      this.validateBucketName();
      await this.ensureBucketExists();
      await this.ensureBucketIsPublic();
      await this.uploadPlaceholderImages();
    } catch (error) {
      this.logger.error("❌ Failed to initialize MediaService:", error);
      throw error;
    }
  }

  /**
   * Validate bucket name follows S3/MinIO rules
   */
  private validateBucketName() {
    // S3/MinIO bucket naming rules:
    // - 3-63 characters
    // - Only lowercase letters, numbers, hyphens, and periods
    // - Must start and end with letter or number
    // - Cannot be formatted as IP address
    // - Cannot have consecutive periods
    const bucketNameRegex = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

    if (this.bucketName.length < 3 || this.bucketName.length > 63) {
      throw new Error(
        `Bucket name must be between 3-63 characters. Current: "${this.bucketName}" (${this.bucketName.length} chars)`,
      );
    }

    if (!bucketNameRegex.test(this.bucketName)) {
      throw new Error(
        `Invalid bucket name: "${this.bucketName}". Must contain only lowercase letters, numbers, hyphens, and periods. Must start and end with letter or number.`,
      );
    }

    // Check for IP address format
    const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
    if (ipRegex.test(this.bucketName)) {
      throw new Error(`Bucket name cannot be formatted as IP address: "${this.bucketName}"`);
    }

    // Check for consecutive periods
    if (this.bucketName.includes("..")) {
      throw new Error(`Bucket name cannot contain consecutive periods: "${this.bucketName}"`);
    }

    this.logger.log(`` + `✅ Bucket name "${this.bucketName}" is valid`);
  }

  /**
   * Check if bucket exists, create it if it doesn't
   */
  private async ensureBucketExists() {
    try {
      this.logger.log("📋 Listing existing buckets...");

      // List all buckets
      const response = await this.s3Client.send(new ListBucketsCommand({}));

      this.logger.log(`📦 Found ${response.Buckets?.length || 0} existing bucket(s)`);

      if (response.Buckets && response.Buckets.length > 0) {
        response.Buckets.forEach((bucket) => {
          this.logger.log(`  - ${bucket.Name}`);
        });
      }

      const bucketExists = response.Buckets?.some((bucket) => bucket.Name === this.bucketName);

      if (bucketExists) {
        this.logger.log(`✅ Bucket "${this.bucketName}" already exists`);
      } else {
        this.logger.log(`📦 Bucket "${this.bucketName}" not found. Creating...`);
        await this.createBucket();
      }
    } catch (error: any) {
      this.logger.error("❌ Error checking bucket existence:", error.message);
      this.logger.error("Error details:", {
        name: error.name as string,
        code: error.Code as string,
        statusCode: error.$metadata?.httpStatusCode as number,
      });
      throw error;
    }
  }

  /**
   * Create a new bucket
   */
  private async createBucket() {
    try {
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.bucketName,
        }),
      );
      this.logger.log(`✅ Bucket "${this.bucketName}" created successfully`);
    } catch (error: any) {
      this.logger.error(`❌ Error creating bucket "${this.bucketName}":`, error.message);
      this.logger.error("Error details:", {
        name: error.name as string,
        code: error.Code as string,
        statusCode: error.$metadata?.httpStatusCode as number,
      });
      throw error;
    }
  }

  /**
   * Set bucket policy to allow public read access
   */
  private async ensureBucketIsPublic() {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: ["*"],
          },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${this.bucketName}/*`],
        },
      ],
    };

    try {
      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucketName,
          Policy: JSON.stringify(policy),
        }),
      );
      this.logger.log("✅ Bucket policy set to public successfully");
    } catch (error) {
      // MinIO/RustFS bucket policies work differently - this error is safe to ignore
      // File uploads/downloads will still work correctly
      this.logger.warn("ℹ️  Bucket policy not set (MinIO/RustFS default permissions apply)");
      this.logger.debug("Policy error (safe to ignore):", error);
    }
  }

  /**
   * Upload placeholder images from public folder to MinIO
   */
  private async uploadPlaceholderImages() {
    try {
      const publicPath = join(process.cwd(), "public");
      const placeholderFolder = join(publicPath, "placeholders");

      this.logger.log(`📂 Checking for placeholder images in: /public/placeholders`);

      // Check if placeholder folder exists
      let files: string[];
      try {
        files = await readdir(placeholderFolder);
      } catch (error) {
        console.log(
          "🚀 ~ media.service.ts:279 ~ MediaService ~ uploadPlaceholderImages ~ error:",
          error,
        );

        this.logger.warn(`⚠️  Placeholder folder not found: ${placeholderFolder}`);
        return;
      }

      // Filter only image files
      const imageFiles = files.filter((file) =>
        this.imageExtensions.includes(extname(file).toLowerCase()),
      );

      if (imageFiles.length === 0) {
        this.logger.log("ℹ️  No placeholder images found");
        return;
      }

      this.logger.log(`🖼️  Found ${imageFiles.length} placeholder image(s)`);

      // Upload each image if it doesn't exist in MinIO
      for (const fileName of imageFiles) {
        await this.uploadPlaceholderIfNotExists(placeholderFolder, fileName);
      }

      this.logger.log("✅ Placeholder images sync completed");
    } catch (error) {
      this.logger.error("❌ Error uploading placeholder images:", error);
      // Don't throw error - allow app to continue even if placeholders fail
    }
  }

  /**
   * Upload a single placeholder image if it doesn't exist in bucket
   */
  private async uploadPlaceholderIfNotExists(folderPath: string, fileName: string) {
    const key = `placeholders/${fileName}`;

    try {
      // Check if file already exists in MinIO
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      this.logger.log(`⏭️  Skipping "${fileName}" (already exists)`);
    } catch (error: any) {
      // File doesn't exist, upload it
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        await this.uploadPlaceholderFile(folderPath, fileName, key);
      } else {
        this.logger.error(`❌ Error checking "${fileName}":`, error);
      }
    }
  }

  /**
   * Get MIME type for a file
   */
  private getMimeType(fileName: string): string {
    const detected = lookup(fileName);
    if (typeof detected === "string") {
      return detected;
    }
    return "application/octet-stream";
  }

  /**
   * Upload placeholder file to MinIO
   */
  private async uploadPlaceholderFile(folderPath: string, fileName: string, key: string) {
    try {
      const filePath = join(folderPath, fileName);
      const fileBuffer = await readFile(filePath);
      const mimeType = this.getMimeType(fileName);

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
        }),
      );

      this.logger.log(`✅ Uploaded "${fileName}" to MinIO`);
    } catch (error) {
      this.logger.error(`❌ Error uploading "${fileName}":`, error);
    }
  }

  /**
   * Determine the file type category (image, video, or other)
   */
  private getFileCategory(fileName: string): "images" | "videos" | "files" {
    const ext = extname(fileName).toLowerCase();

    if (this.imageExtensions.includes(ext)) {
      return "images";
    }

    if (this.videoExtensions.includes(ext)) {
      return "videos";
    }

    return "files";
  }

  /**
   * Generate organized folder path based on file type
   */
  private getOrganizedFolder(fileName: string, customFolder?: string): string {
    const category = this.getFileCategory(fileName);

    if (customFolder) {
      return `${category}/${customFolder}/`;
    }

    return `${category}/`;
  }

  // ============================================
  // PUBLIC API METHODS
  // ============================================

  /**
   * Upload a file to MinIO with automatic folder organization
   * Images go to 'images/' folder, videos to 'videos/', others to 'files/'
   */
  async uploadFile(
    file: Express.Multer.File,
    customFolder?: string,
  ): Promise<{ key: string; url: string; category: string }> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const folder = this.getOrganizedFolder(file.originalname, customFolder);
    const key = `${folder}${Date.now()}-${file.originalname}`;
    const category = this.getFileCategory(file.originalname);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      key,
      // url: `${this.mediaEndpoint}/${this.bucketName}/${key}`,
      url: key,
      category,
    };
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    this.logger.log(`🗑️  Deleted file: "${key}"`);
  }

  /**
   * Get signed URL for a file (temporary access)
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get public URL for a file (permanent access)
   */
  getPublicUrl(key: string): string {
    return `${this.mediaEndpoint}/${this.bucketName}/${key}`;
  }
}
