from .extension_node import InteractiveExtensionNode

NODE_CLASS_MAPPINGS = {
    "InteractiveExtensionNode": InteractiveExtensionNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "InteractiveExtensionNode": "Interactive Image Extension (交互式外扩)"
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
