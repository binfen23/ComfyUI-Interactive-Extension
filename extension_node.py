import os
import torch
import numpy as np
from PIL import Image
import folder_paths
import random
class InteractiveExtensionNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "ui_canvas_size": ("INT", {"default": 5000, "min": 512, "max": 10000}),
                "aspect_ratio": (["custom", "1:1", "9:16", "16:9", "4:3", "3:4"], {"default": "custom"}),
                "top": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "bottom": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "left": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "right": ("INT", {"default": 0, "min": 0, "max": 8192}),
            }
        }
    RETURN_TYPES = ("INT", "INT", "INT", "INT")
    RETURN_NAMES = ("上 (top)", "下 (bottom)", "左 (left)", "右 (right)")
    FUNCTION = "get_padding"
    CATEGORY = "image/layout"
    OUTPUT_NODE = True
    def get_padding(self, image, ui_canvas_size, aspect_ratio, top, bottom, left, right):
        batch_img = image[0]
        i = 255. * batch_img.cpu().numpy()
        img_pil = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
        width, height = img_pil.size
        preview_data = self._save_preview(img_pil)
        return {
            "ui": {"extension_preview": [preview_data], "img_size": [width, height]}, 
            "result": (int(top), int(bottom), int(left), int(right))
        }
    def _save_preview(self, img):
        output_dir = folder_paths.get_temp_directory()
        filename = f"ext_box_{random.randint(1, 1000000)}.png"
        img.save(os.path.join(output_dir, filename))
        return {"filename": filename, "subfolder": "", "type": "temp"}
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")
NODE_DISPLAY_NAME_MAPPINGS = {
    "InteractiveExtensionNode": "Interactive Image Extension (by Zeb)"
}
