#!/usr/bin/env python3
"""Precision cleanup for premium closed chest left matte; keep solid treasure untouched."""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt, gaussian_filter, label

IMAGE=Path("assets/gacha/frames/chest_premium_closed.webp")
EXPECTED_SHA="3f8ff090e6a45dec757493618d6a711809065107"

def main():
    raw=IMAGE.read_bytes()
    sha=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\x00"+raw).hexdigest()
    if sha!=EXPECTED_SHA:
        raise RuntimeError(f"Input changed ({sha}); refusing to edit an unreviewed asset")
    original=Image.open(IMAGE).convert("RGBA")
    px=np.array(original)
    h,w=px.shape[:2]
    if (w,h)!=(680,530):
        raise RuntimeError(f"Unexpected image dimensions: {w}×{h}")
    alpha=px[:,:,3].copy()
    solid=alpha>=115
    components,count=label(solid,structure=np.ones((3,3),dtype=np.uint8))
    sizes=np.bincount(components.ravel())
    sizes[0]=0
    main_body=components==int(np.argmax(sizes))
    if main_body.sum()<solid.sum()*.85:
        raise RuntimeError("Chest silhouette unexpectedly disconnected")
    yy,xx=np.indices((h,w))
    focus=(xx<120)&(yy>=58)&(yy<=int(h*.79))
    smoothed=gaussian_filter(main_body.astype(np.float32),sigma=.72,truncate=2)
    correction=np.minimum(alpha.astype(np.float32),np.clip((smoothed-.055)/.89,0,1)*255)
    repaired=alpha.copy()
    fringe=focus&(alpha<230)
    repaired[fringe]=correction[fringe].astype(np.uint8)
    outside=~binary_dilation(main_body,structure=np.ones((3,3)),iterations=1)
    repaired[focus&outside&(alpha<215)]=0
    repaired[focus&(alpha<17)]=0
    # Nearest fully opaque chest pigment replaces contamination on SEMI-transparent
    # pixels only; never touch solid red cloth or gold ornament texture.
    opaque=(alpha>=240)&main_body
    _,nearest=distance_transform_edt(~opaque,return_indices=True)
    border=focus&(repaired>0)&(repaired<180)
    ry,rx=np.nonzero(border)
    iy,ix=nearest[0,ry,rx],nearest[1,ry,rx]
    weight=np.clip((180-repaired[ry,rx])/370,.12,.42)[:,None]
    px[ry,rx,:3]=np.clip(
        px[ry,rx,:3].astype(np.float32)*(1-weight)
        + px[iy,ix,:3].astype(np.float32)*weight,
        0,255).astype(np.uint8)
    px[:,:,3]=repaired
    if not np.array_equal(alpha[alpha>=230],repaired[alpha>=230]):
        raise RuntimeError("Solid artwork would be erased")
    changed=int(np.count_nonzero(alpha!=repaired))
    removed=int(np.count_nonzero((alpha>0)&(repaired==0)))
    if changed<150 or changed>5000:
        raise RuntimeError(f"Unexpected amount of silhouette edits ({changed})")
    Image.fromarray(px,"RGBA").save(IMAGE,"WEBP",quality=94,method=6,exact=True)
    if Image.open(IMAGE).size!=(680,530):
        raise RuntimeError("Output dimensions changed")
    print(f"premium matte: {changed} local alpha pixels adjusted, {removed} flecks removed")
    print(f"updated {IMAGE} ({IMAGE.stat().st_size} bytes)")

if __name__=="__main__":
    main()
