<?php

namespace App\Services\Contracts;

use App\Models\Photo;

interface AiImageValidator
{
    /**
     * Validate a photo using AI and return structured result.
     *
     * @return array{
     *   result: array,
     *   decision: string,
     *   confidence: float,
     *   model: string,
     *   prompt_version: string
     * }
     */
    public function validate(Photo $photo): array;
}
