import { BadRequestException, Injectable } from '@nestjs/common';

const FORBIDDEN_CHARS = /[\s;&|`$><()]/;
const IMAGE_REF_REGEX =
  /^(?:[a-zA-Z0-9.-]+(?::[0-9]+)?\/)?(?:[a-z0-9._-]+\/)*[a-z0-9._-]+(?::[A-Za-z0-9_.-]+)?$/;

@Injectable()
export class ImageValidationService {
  validate(imageRef: string): string {
    if (!imageRef) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Image reference required' });
    }

    const trimmed = imageRef.trim();
    if (FORBIDDEN_CHARS.test(trimmed)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Image reference contains forbidden characters or whitespace.',
      });
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Do not include http/https prefixes for container images.',
      });
    }

    if (!IMAGE_REF_REGEX.test(trimmed)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid image reference format.',
      });
    }

    return trimmed;
  }
}
