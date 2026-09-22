<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class RoadSegment extends Model
{
    protected $fillable = ['name', 'road_class', 'district'];
}
