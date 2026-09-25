#!/usr/bin/env python3
"""Software preview of a generated block model: back, 3/4, side and top views.

Usage: python3 tools/render_preview.py angel_wings   -> previews/angel_wings.png
"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent.parent
name = sys.argv[1]
out = ROOT / 'previews' / f'{name}.png'
base = str(ROOT / 'resourcepack' / 'assets' / 'okrip') + '/'
m=json.load(open(base+f'models/item/cosmetics/{name}.json'))
tex=np.array(Image.open(base+f'textures/item/cosmetics/{name}.png').convert('RGBA'))
TH,TW=tex.shape[:2]
def rotY(p,o,a):
    a=math.radians(a); x,y,z=p[0]-o[0],p[1]-o[1],p[2]-o[2]
    return (x*math.cos(a)+z*math.sin(a)+o[0], y+o[1], -x*math.sin(a)+z*math.cos(a)+o[2])
def face_fn(f,x0,y0,z0,x1,y1,z1):
    return {
     'south':lambda s,t:(x0+s*(x1-x0),y1-t*(y1-y0),z1),
     'north':lambda s,t:(x1-s*(x1-x0),y1-t*(y1-y0),z0),
     'east':lambda s,t:(x1,y1-t*(y1-y0),z1-s*(z1-z0)),
     'west':lambda s,t:(x0,y1-t*(y1-y0),z0+s*(z1-z0)),
     'up':lambda s,t:(x0+s*(x1-x0),y1,z0+t*(z1-z0)),
     'down':lambda s,t:(x0+s*(x1-x0),y0,z1-t*(z1-z0)),
    }[f]
normals={'south':(0,0,1),'north':(0,0,-1),'east':(1,0,0),'west':(-1,0,0),'up':(0,1,0),'down':(0,-1,0)}
def render(yaw,pitch,size=520):
    # camera looks from direction (yaw around y from +z, pitch down)
    cy,sy=math.cos(math.radians(yaw)),math.sin(math.radians(yaw)); cp,sp=math.cos(math.radians(pitch)),math.sin(math.radians(pitch))
    def view(p):
        x,y,z=p[0]-8,p[1]-8,p[2]-8
        x,z = x*cy - z*sy, x*sy + z*cy   # yaw
        y,z = y*cp - z*sp, y*sp + z*cp   # pitch
        return x,y,z
    polys=[]
    for el in m['elements']:
        (x0,y0,z0),(x1,y1,z1)=el['from'],el['to']; rot=el.get('rotation')
        for f,fd in el['faces'].items():
            u0,v0,u1,v1=fd['uv']; fn=face_fn(f,x0,y0,z0,x1,y1,z1)
            n=normals[f]
            if rot: n=rotY(n,(0,0,0),rot['angle'])
            nv=view((n[0]+8,n[1]+8,n[2]+8))
            if nv[2]<=1e-6: continue  # backface (camera at +z)
            ns=max(1,round(abs(u1-u0)*TW/16)); nt=max(1,round(abs(v1-v0)*TH/16))
            shade=0.65+0.35*max(0,(nv[2]*0.8+nv[1]*0.5))
            for i in range(ns):
                for j in range(nt):
                    uc=u0+(i+.5)/ns*(u1-u0); vc=v0+(j+.5)/nt*(v1-v0)
                    c=tex[min(TH-1,int(vc*TH/16)),min(TW-1,int(uc*TW/16))]
                    if c[3]<128: continue
                    pts=[fn(i/ns,j/nt),fn((i+1)/ns,j/nt),fn((i+1)/ns,(j+1)/nt),fn(i/ns,(j+1)/nt)]
                    if rot: pts=[rotY(p,rot['origin'],rot['angle']) for p in pts]
                    vp=[view(p) for p in pts]
                    polys.append((sum(p[2] for p in vp)/4,[(p[0],p[1]) for p in vp],tuple(int(min(255,k*shade)) for k in c[:3])))
    polys.sort(key=lambda q:q[0])
    img=Image.new('RGB',(size,size),(38,70,52)); d=ImageDraw.Draw(img); sc=size/52
    for _,pts,col in polys:
        d.polygon([(size/2+x*sc,size/2-y*sc) for x,y in pts],fill=col)
    return img
views=[(0,0),(35,20),(90,0),(0,89)]
imgs=[render(y,p) for y,p in views]
W=Image.new('RGB',(520*4,520)); [W.paste(im,(i*520,0)) for i,im in enumerate(imgs)]; W.save(out)
