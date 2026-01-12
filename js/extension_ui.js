import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "Comfy.InteractiveExtension",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "InteractiveExtensionNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            this.img_obj = new Image();
            this.img_loaded = false;
            this.origSize = { w: 1, h: 1 };
            this.padding = { top: 0, bottom: 0, left: 0, right: 0 };
            this.activeHandle = null;

            this.getW = (name) => this.widgets.find(w => w.name === name);

            // 比例计算逻辑
            this.applyRatio = (ratioStr) => {
                if (ratioStr === "custom" || !this.img_loaded) return;
                const parts = ratioStr.split(':');
                const targetRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
                const currentRatio = this.origSize.w / this.origSize.h;

                let t=0, b=0, l=0, r=0;
                if (currentRatio > targetRatio) {
                    const targetHeight = this.origSize.w / targetRatio;
                    const diff = (targetHeight - this.origSize.h) / 2;
                    t = b = Math.round(diff);
                } else {
                    const targetWidth = this.origSize.h * targetRatio;
                    const diff = (targetWidth - this.origSize.w) / 2;
                    l = r = Math.round(diff);
                }
                this.padding = { top: t, bottom: b, left: l, right: r };
                this.syncWidgets();
                this.setDirtyCanvas(true, true);
            };

            // 绑定比例选择器的回调
            const ratioWidget = this.getW("aspect_ratio");
            if (ratioWidget) {
                ratioWidget.callback = (v) => { this.applyRatio(v); };
            }

            // --- 核心修复：绑定四个方向数值框的回调 ---
            ["top", "bottom", "left", "right"].forEach(dir => {
                const w = this.getW(dir);
                if (w) {
                    w.callback = (v) => {
                        this.padding[dir] = v; // 当手动修改数值时，同步到内部变量
                        this.setDirtyCanvas(true, true); // 刷新画布
                    };
                }
            });

            // 同步变量到 Widget
            this.syncWidgets = () => {
                ["top", "bottom", "left", "right"].forEach(d => {
                    const w = this.getW(d);
                    if(w) w.value = Math.round(this.padding[d]);
                });
            };

            this.setSize([550, 780]);
        };

        nodeType.prototype.onExecuted = function(message) {
            if (message?.extension_preview?.length > 0) {
                this.origSize.w = message.img_size[0];
                this.origSize.h = message.img_size[1];
                const img = message.extension_preview[0];
                this.img_obj.src = api.apiURL(`/view?filename=${img.filename}&type=${img.type}&subfolder=${img.subfolder}`);
                this.img_obj.onload = () => {
                    this.img_loaded = true;
                    // 初始化时根据当前设置刷新一次画布
                    ["top", "bottom", "left", "right"].forEach(dir => {
                        this.padding[dir] = this.getW(dir).value;
                    });
                    if(this.getW("aspect_ratio").value !== "custom") this.applyRatio(this.getW("aspect_ratio").value);
                    this.setDirtyCanvas(true, true);
                };
            }
        };

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (!this.img_loaded) return;

            const margin = 20;
            const topPadding = 220; 
            const bottomMargin = 20;

            const availableW = this.size[0] - margin * 2;
            const availableH = this.size[1] - topPadding - bottomMargin;
            const uiLimit = this.getW("ui_canvas_size").value;
            const scale = Math.min(availableW / uiLimit, availableH / uiLimit);
            
            const canvasDisplayW = uiLimit * scale;
            const canvasDisplayH = uiLimit * scale;
            const offsetX = margin + (availableW - canvasDisplayW) / 2;
            const offsetY = topPadding + (availableH - canvasDisplayH) / 2;

            this.viewParams = { scale, cx: offsetX + canvasDisplayW / 2, cy: offsetY + canvasDisplayH / 2 };

            ctx.fillStyle = "#0f0f11";
            ctx.beginPath();
            ctx.roundRect(offsetX, offsetY, canvasDisplayW, canvasDisplayH, 12);
            ctx.fill();
            
            const { cx, cy } = this.viewParams;
            const iw = this.origSize.w * scale, ih = this.origSize.h * scale;
            const ix = cx - iw/2, iy = cy - ih/2;
            ctx.drawImage(this.img_obj, ix, iy, iw, ih);

            const bx = ix - this.padding.left * scale, by = iy - this.padding.top * scale;
            const bw = iw + (this.padding.left + this.padding.right) * scale;
            const bh = ih + (this.padding.top + this.padding.bottom) * scale;

            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1;
            for(let i=1; i<=2; i++) {
                ctx.beginPath(); ctx.moveTo(bx + bw*(i/3), by); ctx.lineTo(bx + bw*(i/3), by + bh); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(bx, by + bh*(i/3)); ctx.lineTo(bx + bw, by + bh*(i/3)); ctx.stroke();
            }

            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, bw, bh);

            const handleSize = 20;
            const thickness = 4;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = thickness;
            ctx.lineCap = "round";

            const corners = [
                [bx, by, 1, 1],
                [bx + bw, by, -1, 1],
                [bx, by + bh, 1, -1],
                [bx + bw, by + bh, -1, -1]
            ];
            corners.forEach(([x, y, dx, dy]) => {
                ctx.beginPath();
                ctx.moveTo(x, y + handleSize * dy);
                ctx.lineTo(x, y);
                ctx.lineTo(x + handleSize * dx, y);
                ctx.stroke();
            });

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 13px sans-serif";
            const totalW = Math.round(this.origSize.w + this.padding.left + this.padding.right);
            const totalH = Math.round(this.origSize.h + this.padding.top + this.padding.bottom);
            ctx.fillText(`${totalW} × ${totalH}`, bx + 2, by - 12);

            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.font = "italic 11px sans-serif";
            const authorText = "by Zeb";
            const textWidth = ctx.measureText(authorText).width;
            ctx.fillText(authorText, offsetX + canvasDisplayW - textWidth - 10, offsetY + canvasDisplayH - 10);
        };

        nodeType.prototype.onMouseMove = function(e, local_pos) {
            if (!this.viewParams) return;
            const [mx, my] = local_pos;
            const { scale, cx, cy } = this.viewParams;
            const ix = cx - (this.origSize.w * scale)/2, iy = cy - (this.origSize.h * scale)/2;
            const bx = ix - this.padding.left * scale, by = iy - this.padding.top * scale;
            const bw = (this.origSize.w + this.padding.left + this.padding.right) * scale;
            const bh = (this.origSize.h + this.padding.top + this.padding.bottom) * scale;

            const dist = (x1, y1) => Math.sqrt((mx-x1)**2 + (my-y1)**2);
            const hit = 20;

            if (!this.activeHandle) {
                if (dist(bx, by) < hit) canvas.style.cursor = "nw-resize";
                else if (dist(bx+bw, by) < hit) canvas.style.cursor = "ne-resize";
                else if (dist(bx, by+bh) < hit) canvas.style.cursor = "sw-resize";
                else if (dist(bx+bw, by+bh) < hit) canvas.style.cursor = "se-resize";
                else canvas.style.cursor = "default";
            }

            if (!this.activeHandle) return;

            const mouseImgX = (mx - ix) / scale, mouseImgY = (my - iy) / scale;
            if (this.activeHandle === "tl") { 
                this.padding.left = Math.max(0, -mouseImgX); 
                this.padding.top = Math.max(0, -mouseImgY); 
            } else if (this.activeHandle === "br") { 
                this.padding.right = Math.max(0, mouseImgX - this.origSize.w); 
                this.padding.bottom = Math.max(0, mouseImgY - this.origSize.h); 
            } else if (this.activeHandle === "tr") { 
                this.padding.right = Math.max(0, mouseImgX - this.origSize.w); 
                this.padding.top = Math.max(0, -mouseImgY); 
            } else if (this.activeHandle === "bl") { 
                this.padding.left = Math.max(0, -mouseImgX); 
                this.padding.bottom = Math.max(0, mouseImgY - this.origSize.h); 
            }
            this.syncWidgets();
            this.setDirtyCanvas(true, true);
        };

        nodeType.prototype.onMouseDown = function(e, local_pos) {
            if (!this.viewParams) return;
            const [mx, my] = local_pos;
            const { scale, cx, cy } = this.viewParams;
            const ix = cx - (this.origSize.w * scale)/2, iy = cy - (this.origSize.h * scale)/2;
            const bx = ix - this.padding.left * scale, by = iy - this.padding.top * scale;
            const bw = (this.origSize.w + this.padding.left + this.padding.right) * scale;
            const bh = (this.origSize.h + this.padding.top + this.padding.bottom) * scale;
            const dist = (x1, y1) => Math.sqrt((mx-x1)**2 + (my-y1)**2);
            
            if (dist(bx, by) < 25) this.activeHandle = "tl";
            else if (dist(bx+bw, by) < 25) this.activeHandle = "tr";
            else if (dist(bx, by+bh) < 25) this.activeHandle = "bl";
            else if (dist(bx+bw, by+bh) < 25) this.activeHandle = "br";
            
            if (this.activeHandle) { 
                this.getW("aspect_ratio").value = "custom"; 
                return true; 
            }
        };

        nodeType.prototype.onMouseUp = function() { 
            this.activeHandle = null; 
            canvas.style.cursor = "default";
        };
        
        nodeType.prototype.onMouseLeave = function() { canvas.style.cursor = "default"; };
    }
});
