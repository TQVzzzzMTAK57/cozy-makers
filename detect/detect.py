"""
detect.py  –  YOLOv8 inference with best4.pt
Usage:
    python detect.py --input <path> --output <path> [--conf 0.25]

Supports: jpg, jpeg, png, bmp, gif, webp (image)  |  mp4, avi, mov, mkv, webm (video)
Prints a JSON result to stdout.
"""
import argparse
import json
import os
import sys
import time

# ── suppress ultralytics / torch noise ────────────────────────────────────────
os.environ["YOLO_VERBOSE"] = "False"

try:
    from ultralytics import YOLO
    import cv2
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}))
    sys.exit(1)

DETECT_DIR  = os.path.dirname(__file__)
MODEL_FILES = {
    "yolo11":  "best4.pt",
    "yolo26":  "best_yolo26.pt",
}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def load_model(model_key="yolo11"):
    filename  = MODEL_FILES.get(model_key, MODEL_FILES["yolo11"])
    model_path = os.path.join(DETECT_DIR, filename)
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Model not found: {model_path}"}))
        sys.exit(1)
    return YOLO(model_path)


# ── GPS helpers ────────────────────────────────────────────────────────────────
def _dms_to_decimal(dms, ref):
    """Convert EXIF DMS tuple to decimal degrees."""
    d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
    dd = d + m / 60.0 + s / 3600.0
    if ref in ('S', 'W'):
        dd = -dd
    return round(dd, 8)


def extract_gps_exif(image_path: str):
    """
    Extract GPS info from image EXIF.
    Returns dict {lat, lon, alt} or None if no GPS data found.
    """
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS, GPSTAGS

        img = Image.open(image_path)
        exif_raw = img._getexif()  # type: ignore[attr-defined]
        if not exif_raw:
            return None

        exif = {TAGS.get(k, k): v for k, v in exif_raw.items()}
        gps_info_raw = exif.get("GPSInfo")
        if not gps_info_raw:
            return None

        gps = {GPSTAGS.get(k, k): v for k, v in gps_info_raw.items()}

        lat = _dms_to_decimal(gps["GPSLatitude"], gps["GPSLatitudeRef"])
        lon = _dms_to_decimal(gps["GPSLongitude"], gps["GPSLongitudeRef"])

        alt = None
        if "GPSAltitude" in gps:
            alt = round(float(gps["GPSAltitude"]), 2)
            ref = gps.get("GPSAltitudeRef", 0)
            if ref == 1:   # below sea level
                alt = -alt

        return {"lat": lat, "lon": lon, "alt": alt}

    except Exception:
        return None


def pixel_to_gps(drone_gps: dict, img_w: int, img_h: int,
                 px: float, py: float,
                 fov_h: float = 84.0, fov_v: float = 48.8) -> dict | None:
    """
    Convert pixel center (px, py) to GPS coordinate.

    Assumptions:
      - Drone is at drone_gps {lat, lon, alt} looking straight down
      - Camera FOV: horizontal 84°, vertical 48.8° (DJI Mavic-class default)
      - Flat terrain (no DEM correction)

    Parameters:
        drone_gps : {lat, lon, alt (meters AGL)}
        img_w/h   : image pixel dimensions
        px/py     : pixel coordinates of object center
        fov_h/v   : camera horizontal/vertical FOV in degrees
    """
    import math

    alt = drone_gps.get("alt")
    if alt is None or alt <= 0:
        return None   # can't compute without altitude

    lat0 = drone_gps["lat"]
    lon0 = drone_gps["lon"]

    # Ground footprint at given altitude
    ground_w = 2 * alt * math.tan(math.radians(fov_h / 2))   # metres
    ground_h = 2 * alt * math.tan(math.radians(fov_v / 2))   # metres

    # Metres per pixel
    mpp_x = ground_w / img_w
    mpp_y = ground_h / img_h

    # Pixel offset from image center (positive x → east, positive y → north)
    dx_m = (px - img_w / 2) * mpp_x
    dy_m = (img_h / 2 - py) * mpp_y   # y-axis flipped (image top = north)

    # Convert metres offset to degrees
    lat_deg_per_m = 1.0 / 111_320.0
    lon_deg_per_m = 1.0 / (111_320.0 * math.cos(math.radians(lat0)))

    obj_lat = round(lat0 + dy_m * lat_deg_per_m, 8)
    obj_lon = round(lon0 + dx_m * lon_deg_per_m, 8)

    return {
        "lat": obj_lat,
        "lon": obj_lon,
        "google_maps_url": f"https://www.google.com/maps?q={obj_lat},{obj_lon}",
        "dx_meters": round(dx_m, 1),
        "dy_meters": round(dy_m, 1),
    }


# ── image inference ────────────────────────────────────────────────────────────
def detect_image(model, input_path: str, output_path: str, conf: float):
    results = model.predict(source=input_path, conf=conf, verbose=False)
    result = results[0]

    # annotated frame
    annotated = result.plot()
    cv2.imwrite(output_path, annotated)

    # Image dimensions
    img_h, img_w = annotated.shape[:2]

    # Extract GPS from EXIF
    drone_gps = extract_gps_exif(input_path)

    detections = []
    boxes = result.boxes
    if boxes is not None:
        for box in boxes:
            cls_id = int(box.cls[0])
            label = model.names.get(cls_id, str(cls_id))
            confidence = float(box.conf[0])
            xyxy = box.xyxy[0].tolist()

            # Centre of bounding box
            cx = (xyxy[0] + xyxy[2]) / 2
            cy = (xyxy[1] + xyxy[3]) / 2

            det: dict = {
                "label":      label,
                "confidence": round(confidence, 4),
                "x":          round(xyxy[0]),
                "y":          round(xyxy[1]),
                "width":      round(xyxy[2] - xyxy[0]),
                "height":     round(xyxy[3] - xyxy[1]),
                "center_px":  [round(cx), round(cy)],
            }

            # GPS coordinate of this detection
            if drone_gps:
                gps_coord = pixel_to_gps(drone_gps, img_w, img_h, cx, cy)
                if gps_coord:
                    det["gps"] = gps_coord

            detections.append(det)

    return {
        "type":             "image",
        "detections":       detections,
        "output_path":      output_path,
        "total_detections": len(detections),
        "drone_gps":        drone_gps,   # None if no EXIF, else {lat, lon, alt}
        "image_size":       [img_w, img_h],
    }


# ── video inference (PyAV → H.264 MP4, browser-compatible) ────────────────────
def detect_video(model, input_path: str, output_path: str, conf: float):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {input_path}"}

    fps   = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Always write .mp4 with H.264 via PyAV (browser-compatible)
    output_path = os.path.splitext(output_path)[0] + ".mp4"

    try:
        import av as _av
        _use_pyav = True
    except ImportError:
        _use_pyav = False

    if _use_pyav:
        # ── PyAV H.264 writer ─────────────────────────────────────────────────
        container = _av.open(output_path, mode="w")
        stream    = container.add_stream("libx264", rate=int(fps))
        stream.width  = w
        stream.height = h
        stream.pix_fmt = "yuv420p"
        # fast-start: moov atom at front so browser can stream without full download
        stream.options = {"movflags": "faststart", "preset": "ultrafast", "crf": "28"}

        def _write_pyav(bgr_frame):
            rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
            vf  = _av.VideoFrame.from_ndarray(rgb, format="rgb24")
            vf  = vf.reformat(format="yuv420p")
            for pkt in stream.encode(vf):
                container.mux(pkt)

        def _flush_pyav():
            for pkt in stream.encode():
                container.mux(pkt)
            container.close()

    else:
        # ── Fallback: OpenCV MJPEG AVI (older browsers may not play) ─────────
        output_path = os.path.splitext(output_path)[0] + ".avi"
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))
        _write_pyav  = writer.write    # type: ignore[assignment]
        _flush_pyav  = writer.release  # type: ignore[assignment]

    all_detections: dict = {}
    frame_results  = []
    frame_idx      = 0
    SAMPLE_EVERY   = max(1, int(fps // 5))   # ~5 inferences/sec
    last_annotated = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % SAMPLE_EVERY == 0:
            results = model.predict(source=frame, conf=conf, verbose=False)
            result  = results[0]
            last_annotated = result.plot()

            boxes = result.boxes
            frame_dets = []
            if boxes is not None:
                for box in boxes:
                    cls_id     = int(box.cls[0])
                    label      = model.names.get(cls_id, str(cls_id))
                    confidence = float(box.conf[0])
                    xyxy       = box.xyxy[0].tolist()
                    det = {
                        "label":      label,
                        "confidence": round(confidence, 4),
                        "x":          round(xyxy[0]),
                        "y":          round(xyxy[1]),
                        "width":      round(xyxy[2] - xyxy[0]),
                        "height":     round(xyxy[3] - xyxy[1]),
                        "frame":      frame_idx,
                    }
                    frame_dets.append(det)
                    if label not in all_detections or all_detections[label]["confidence"] < confidence:
                        all_detections[label] = {k: v for k, v in det.items() if k != "frame"}

            if frame_dets:
                frame_results.append({"frame": frame_idx, "detections": frame_dets})

        # Write annotated frame if available, else original
        _write_pyav(last_annotated if last_annotated is not None else frame)
        frame_idx += 1

    cap.release()
    _flush_pyav()

    return {
        "type":             "video",
        "detections":       list(all_detections.values()),
        "frame_results":    frame_results[:20],
        "total_frames":     frame_idx,
        "output_path":      output_path,
        "total_detections": len(all_detections),
    }


# ── main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="YOLO detect – supports YOLO11 and YOLO26")
    parser.add_argument("--input",  required=True,  help="Path to input file")
    parser.add_argument("--output", required=True,  help="Path to output file")
    parser.add_argument("--conf",   type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--model",  default="yolo11",
                        choices=list(MODEL_FILES.keys()),
                        help="Model to use: yolo11 (best4.pt) or yolo26 (best_yolo26.pt)")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    ext   = os.path.splitext(args.input)[1].lower()
    model = load_model(args.model)

    t0 = time.time()
    if ext in IMAGE_EXTS:
        result = detect_image(model, args.input, args.output, args.conf)
    elif ext in VIDEO_EXTS:
        result = detect_video(model, args.input, args.output, args.conf)
    else:
        print(json.dumps({"error": f"Unsupported file extension: {ext}"}))
        sys.exit(1)

    result["elapsed_seconds"] = round(time.time() - t0, 2)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
