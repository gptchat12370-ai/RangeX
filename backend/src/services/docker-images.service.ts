import { Injectable, Logger } from "@nestjs/common";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DockerImage {
  repository: string;
  tag: string;
  imageId: string;
  created: string;
  size: string;
  isLocal: boolean;
}

@Injectable()
export class DockerImagesService {
  private readonly logger = new Logger(DockerImagesService.name);

  /**
   * Get list of local Docker images
   */
  async getLocalImages(): Promise<DockerImage[]> {
    try {
      const { stdout } = await execAsync('docker images --format "{{.Repository}}|{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}"');
      
      if (!stdout || stdout.trim() === '') {
        return [];
      }
      
      const images = stdout
        .trim()
        .split("\n")
        .filter(line => line.trim())
        .map(line => {
          const [repository, tag, imageId, created, size] = line.split("|");
          return {
            repository,
            tag,
            imageId,
            created,
            size,
            isLocal: true
          };
        })
        .filter(img => img.repository !== "<none>"); // Filter out dangling images

      this.logger.log(`Found ${images.length} local Docker images`);
      return images;
    } catch (error) {
      this.logger.error("Failed to list Docker images", error);
      return [];
    }
  }

  /**
   * Get curated list of recommended cybersecurity images
   */
  async getRecommendedImages(): Promise<any[]> {
    return [
      {
        repository: "kalilinux/kali-rolling",
        tag: "latest",
        displayName: "Kali Linux (Full)",
        category: "Attacker",
        description: "Full Kali Linux with all penetration testing tools",
        size: "~2GB",
        isPublic: true,
        tags: ["Pentesting", "Security", "Tools"]
      },
      {
        repository: "kalilinux/kali-last-release",
        tag: "latest",
        displayName: "Kali Linux (Latest Release)",
        category: "Attacker",
        description: "Latest stable Kali Linux release",
        size: "~2GB",
        isPublic: true,
        tags: ["Pentesting", "Security"]
      },
      {
        repository: "vulnerables/web-dvwa",
        tag: "latest",
        displayName: "DVWA - Damn Vulnerable Web App",
        category: "Victim",
        description: "PHP/MySQL web application that is damn vulnerable",
        size: "~500MB",
        isPublic: true,
        tags: ["Web", "PHP", "MySQL", "Vulnerable"]
      },
      {
        repository: "vulnerables/cve-2017-7494",
        tag: "latest",
        displayName: "Samba Vulnerable Server",
        category: "Victim",
        description: "Vulnerable Samba server (SambaCry)",
        size: "~300MB",
        isPublic: true,
        tags: ["Samba", "Linux", "Exploit"]
      },
      {
        repository: "ubuntu",
        tag: "latest",
        displayName: "Ubuntu Latest",
        category: "Base",
        description: "Latest Ubuntu base image",
        size: "~80MB",
        isPublic: true,
        tags: ["Linux", "Base"]
      },
      {
        repository: "nginx",
        tag: "alpine",
        displayName: "Nginx (Alpine)",
        category: "Service",
        description: "Lightweight Nginx web server",
        size: "~25MB",
        isPublic: true,
        tags: ["Web", "Server", "Alpine"]
      },
      {
        repository: "mysql",
        tag: "latest",
        displayName: "MySQL Database",
        category: "Service",
        description: "MySQL database server",
        size: "~500MB",
        isPublic: true,
        tags: ["Database", "MySQL"]
      },
      {
        repository: "postgres",
        tag: "alpine",
        displayName: "PostgreSQL (Alpine)",
        category: "Service",
        description: "PostgreSQL database (Alpine)",
        size: "~230MB",
        isPublic: true,
        tags: ["Database", "PostgreSQL"]
      },
      {
        repository: "metasploitframework/metasploit-framework",
        tag: "latest",
        displayName: "Metasploit Framework",
        category: "Attacker",
        description: "Metasploit penetration testing framework",
        size: "~1.5GB",
        isPublic: true,
        tags: ["Exploitation", "Framework"]
      },
      {
        repository: "owasp/zap2docker-stable",
        tag: "latest",
        displayName: "OWASP ZAP",
        category: "Attacker",
        description: "OWASP Zed Attack Proxy for web app security",
        size: "~1GB",
        isPublic: true,
        tags: ["Web", "Security", "Scanner"]
      },
    ];
  }

  /**
   * Pull a Docker image from Docker Hub
   */
  async pullImage(repository: string, tag: string = "latest"): Promise<boolean> {
    try {
      const imageName = `${repository}:${tag}`;
      this.logger.log(`Pulling Docker image: ${imageName}`);
      
      const { stdout } = await execAsync(`docker pull ${imageName}`);
      this.logger.log(`Successfully pulled ${imageName}`);
      this.logger.debug(stdout);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to pull image ${repository}:${tag}`, error);
      return false;
    }
  }

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync("docker --version");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test run a container (for preview/testing)
   */
  async testContainer(imageId: string, containerName: string): Promise<{ success: boolean; containerId?: string; error?: string }> {
    try {
      // Run container in detached mode
      const { stdout } = await execAsync(
        `docker run -d --name ${containerName} ${imageId} tail -f /dev/null`
      );
      
      if (!stdout) {
        throw new Error('No container ID returned from docker run');
      }
      
      const containerId = stdout.trim();
      this.logger.log(`Started test container: ${containerName} (${containerId})`);
      
      return { success: true, containerId };
    } catch (error: any) {
      this.logger.error(`Failed to start test container`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop and remove a test container
   */
  async stopTestContainer(containerName: string): Promise<boolean> {
    try {
      await execAsync(`docker stop ${containerName}`);
      await execAsync(`docker rm ${containerName}`);
      this.logger.log(`Stopped and removed test container: ${containerName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop test container: ${containerName}`, error);
      return false;
    }
  }

  /**
   * Get running containers
   */
  async getRunningContainers(): Promise<any[]> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"');
      
      if (!stdout || stdout.trim() === '') {
        return [];
      }
      
      return stdout
        .trim()
        .split("\n")
        .filter(line => line.trim())
        .map(line => {
          const [id, names, image, status, ports] = line.split("|");
          return { id, names, image, status, ports };
        });
    } catch (error) {
      this.logger.error("Failed to list running containers", error);
      return [];
    }
  }
}
