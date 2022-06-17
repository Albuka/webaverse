import * as THREE from 'three';

import metaversefile from 'metaversefile';
const {useApp, useFrame, useLocalPlayer, useCameraManager, useLoaders, useInternals, usePhysics, useCleanup, getAppByPhysicsId, useRenderSettings} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');


export default () => {
    const app = useApp();
    const localPlayer = useLocalPlayer();
    const cameraManager = useCameraManager();
    const {renderer, camera, scene, rootScene} = useInternals();
    const renderSettings = useRenderSettings();
    const textureLoader = new THREE.TextureLoader();
    const bubbleTexture1 = textureLoader.load(`${baseUrl}/textures/Bubble3.png`);
    const noiseCircleTexture = textureLoader.load(`${baseUrl}/textures/noiseCircle.png`);
    const noiseTexture = textureLoader.load(`${baseUrl}/textures/perlin-noise.jpg`);
    const noiseTexture2 = textureLoader.load(`${baseUrl}/textures/noise.jpg`);

    const waterNormalTexture1 = textureLoader.load(`${baseUrl}/textures/waterNormal2.png`);
    waterNormalTexture1.wrapS = waterNormalTexture1.wrapT = THREE.RepeatWrapping;
    const waterNormalTexture2 = textureLoader.load(`${baseUrl}/textures/waterNormal3.png`);
    waterNormalTexture2.wrapS = waterNormalTexture2.wrapT = THREE.RepeatWrapping;

    
    const waterDerivativeHeightTexture = textureLoader.load(`${baseUrl}/textures/water-derivative-height.png`);
    waterDerivativeHeightTexture.wrapS = waterDerivativeHeightTexture.wrapT = THREE.RepeatWrapping;
    const waterNormalTexture = textureLoader.load(`${baseUrl}/textures/water-normal.png`);
    waterNormalTexture.wrapS = waterNormalTexture.wrapT = THREE.RepeatWrapping;
    const waterNoiseTexture = textureLoader.load(`${baseUrl}/textures/perlin-noise.jpg`);
    waterNoiseTexture.wrapS = waterNoiseTexture.wrapT = THREE.RepeatWrapping;
    const flowmapTexture = textureLoader.load(`${baseUrl}/textures/flowmap.png`);
    flowmapTexture.wrapS = flowmapTexture.wrapT = THREE.RepeatWrapping;

    let water = null;
    const waterSurfacePos = new THREE.Vector3(0, 0, 0);
    const cameraWaterSurfacePos = new THREE.Vector3(0, 0, 0);
    let contactWater = false;
    let wholeBelowwWater = false;
    let floatOnWater = false;
    let cameraDir = new THREE.Vector3();
    let playerDir = new THREE.Vector3();
    const playerHeadPos = new THREE.Vector3();
    let currentSpeed = 0;
    //############################################################# trace camera direction ########################################################################
    {
        const localVector = new THREE.Vector3();
        const localVector2 = new THREE.Vector3();
        useFrame(() => {
            localVector.set(0, 0, -1);
            cameraDir = localVector.applyQuaternion( camera.quaternion );
            cameraDir.normalize();

            localVector2.set(0, 0, -1);
            playerDir = localVector2.applyQuaternion( localPlayer.quaternion );
            playerDir.normalize();
            if(localPlayer.avatar){
                currentSpeed = localVector.set(localPlayer.avatar.velocity.x, 0, localPlayer.avatar.velocity.z).length();
                playerHeadPos.setFromMatrixPosition(localPlayer.avatar.modelBoneOutputs.Head.matrixWorld);
            }
                
            
        });
    }

    //############################################################ trace water surface ########################################################################
    {
        const raycaster = new THREE.Raycaster()
        const localVector = new THREE.Vector3();
        const upVector = new THREE.Vector3(0, 1, 0);
        
        
        useFrame(({timestamp}) => {
            if(localPlayer.avatar && water){
                //############################# contact water ################################
                localVector.set(localPlayer.position.x, localPlayer.position.y - localPlayer.avatar.height, localPlayer.position.z);
                raycaster.set(localVector, upVector);
                let intersect = raycaster.intersectObject(water)
                if (intersect.length > 0) {
                    waterSurfacePos.set(intersect[0].point.x, intersect[0].point.y, intersect[0].point.z);
                    contactWater = true;


                    if(intersect[0].distance >= localPlayer.avatar.height){
                        wholeBelowwWater = true;
                    }
                    else{
                        wholeBelowwWater = false;
                    }
                }
                else{
                    contactWater = false;
                }
                


                //############################# float on water ################################
                localVector.set(localPlayer.position.x, localPlayer.position.y - localPlayer.avatar.height, localPlayer.position.z);
                raycaster.set(localVector, upVector);
                intersect = raycaster.intersectObject(water)
                if (intersect.length > 0) {
                    if(intersect[0].distance < localPlayer.avatar.height * 0.6){
                        if(localPlayer.hasAction('swim')){
                            console.log('remove');
                            localPlayer.removeAction('swim');
                        }
                        
                    }
                    else{
                        if(!localPlayer.hasAction('swim')){
                            console.log('add');
                            const swimAction = {
                                type: 'swim',
                                onSurface: false,
                            };
                            localPlayer.setControlAction(swimAction);
                        }
                    }
                    if(intersect[0].distance > localPlayer.avatar.height * 0.69){
                        if(localPlayer.hasAction('swim'))
                            localPlayer.getAction('swim').onSurface = false;
                        
                    }
                    else{
                        if(localPlayer.hasAction('swim'))
                            localPlayer.getAction('swim').onSurface = true;
                    }
                    
                    
                }
                else{
                    if(localPlayer.hasAction('swim')){
                        console.log('remove');
                        localPlayer.removeAction('swim');
                    }
                    
                }
                

                //############################### camera raycast ###################################
                localVector.set(camera.position.x + cameraDir.x * 0.2, camera.position.y, localPlayer.position.z + cameraDir.z * 0.2);
                raycaster.set(localVector, upVector);
                intersect = raycaster.intersectObject(water);
                if (intersect.length > 0 ) {
                    cameraWaterSurfacePos.set(intersect[0].point.x, intersect[0].point.y, intersect[0].point.z);
                }
                
            }
            
            app.updateMatrixWorld();
        });
    }
    //######################################################################## water ########################################################################
    {
        const waterGeometry = new THREE.PlaneGeometry( 1500, 1500 );
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    type: "f",
                    value: 0.0
                },
                uUJump: {
                    type: "f",
                    value: 0.24
                },
                uVJump: {
                    type: "f",
                    value: 0.208
                },
                uTiling: {
                    type: "f",
                    value: 2
                },
                uSpeed: {
                    type: "f",
                    value: 0.5
                },
                uFlowStrength: {
                    type: "f",
                    value: 0.25
                },
                uFlowOffset: {
                    type: "f",
                    value: -1.5
                },
                sunPosition: {
                    value: new THREE.Vector3(200.0, 1.0, -600.)
                },
                playerPosition: {
                    value: new THREE.Vector3()
                },
                playerDirection: {
                    value: new THREE.Vector3()
                },
                waterDerivativeHeightTexture: {
                    value: waterDerivativeHeightTexture
                },
                waterNoiseTexture: {
                    value: waterNoiseTexture
                },
                flowmapTexture: {
                    value: flowmapTexture
                },

            },
            vertexShader: `\
                
                ${THREE.ShaderChunk.common}
                ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
                
            
                varying vec3 vPos;
                varying vec2 vUv;

                void main() {
                    vPos = position;
                    vUv = uv;
                    vec3 pos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 ); 
                    ${THREE.ShaderChunk.logdepthbuf_vertex}
                }`,
            fragmentShader: `\
                
                
                ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
                varying vec3 vPos;
                varying vec2 vUv;

                uniform mat4 modelMatrix;
                uniform float uTime;
                uniform float uUJump;
                uniform float uVJump;
                uniform float uTiling;
                uniform float uSpeed;
                uniform float uFlowStrength;
                uniform float uFlowOffset;
                uniform vec3 sunPosition;
                uniform vec3 playerPosition;
                uniform vec3 playerDirection;
                
                
                uniform sampler2D waterDerivativeHeightTexture;
                uniform sampler2D waterNoiseTexture;
                uniform sampler2D flowmapTexture;
                
                float frac(float v)
                {
                  return v - floor(v);
                }
                vec3 FlowUVW (vec2 uv, vec2 flowVector, vec2 jump, float flowOffset, float tiling, float time,  bool flowB) {
                    float phaseOffset = flowB ? 0.5 : 0.;
                    float progress = frac(time + phaseOffset);
	                vec3 uvw;
                    uvw.xy = uv - flowVector * (progress + flowOffset);
                    uvw.xy *= tiling;
                    uvw.xy += phaseOffset;
                    uvw.xy += (time - progress) * jump;
                    uvw.z = 1. - abs(1. - 2. * progress);
                    return uvw;
                }
                vec3 UnpackDerivativeHeight (vec4 textureData) {
                    vec3 dh = textureData.agb;
                    dh.xy = dh.xy * 2. - 1.;
                    return dh;
                }
        
                float shineDamper = 150.;
                float reflectivity = 0.12;
                void main() {
                   
                    vec4 worldPosition = modelMatrix * vec4( vPos, 1.0 );
                    vec3 sunToPlayer = normalize(sunPosition - playerPosition); 
                    vec3 worldToEye = vec3(playerPosition.x + sunToPlayer.x * 100., playerPosition.y, playerPosition.z + sunToPlayer.z * 100.)-worldPosition.xyz;
                    
                    vec3 eyeDirection = normalize( worldToEye );
                    vec2 uv = worldPosition.xz * 0.01;

                    vec2 flowmap = texture2D(flowmapTexture, uv / 5.).rg * 2. - 1.;
                    flowmap *= uFlowStrength;
                    float noise = texture2D(flowmapTexture, uv).a;
			        float time = uTime * uSpeed + noise;
                    vec2 jump = vec2(uUJump, uVJump);
                    vec3 uvwA = FlowUVW(uv, flowmap, jump, uFlowOffset, uTiling, time, false);
                    vec3 uvwB = FlowUVW(uv, flowmap, jump, uFlowOffset, uTiling, time, true);

                    vec3 dhA = UnpackDerivativeHeight(texture2D(waterDerivativeHeightTexture, uvwA.xy * 0.5)) * uvwA.z * 1.5;
                    vec3 dhB = UnpackDerivativeHeight(texture2D(waterDerivativeHeightTexture, uvwB.xy * 0.5)) * uvwB.z * 1.5;
                    vec3 surfaceNormal = normalize(vec3(-(dhA.xy + dhB.xy), 1.));

                    vec3 fromSunVector = worldPosition.xyz - (sunPosition + playerPosition);
                    vec3 reflectedLight = reflect(normalize(fromSunVector), surfaceNormal);
                    float specular = max(dot(reflectedLight, eyeDirection), 0.0);
                    specular = pow(specular, shineDamper);
                    vec3 specularHighlight = vec3(0.6,0.6,0.6) * specular * reflectivity;
                       
                    vec4 texA = texture2D(waterNoiseTexture, uvwA.xy) * uvwA.z;
                    vec4 texB = texture2D(waterNoiseTexture, uvwB.xy) * uvwB.z;

                    

                    gl_FragColor = (texA + texB) * vec4(0.1, 0.15, 0.2, 0.7);
                    gl_FragColor += vec4( specularHighlight, 0.0 );
                    ${THREE.ShaderChunk.logdepthbuf_fragment}
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            //blending: THREE.AdditiveBlending,

        
        });
        water = new THREE.Mesh( waterGeometry, waterMaterial );
        app.add( water );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 3;

        useFrame(({timestamp}) => {
            waterMaterial.uniforms.uTime.value = timestamp / 1000;
            waterMaterial.uniforms.playerPosition.value.copy(localPlayer.position);
            waterMaterial.uniforms.playerDirection.value.copy(playerDir);
            
            app.updateMatrixWorld();
        });
      
    }
     //#################################################################### underwater mask ###################################################################
    {
        
        // const color = 0xFF0000;
        // const density = 0.1;
        // rootScene.fog = new THREE.FogExp2(color, 1);
        // rootScene.updateMatrixWorld();
        
        rootScene.fog = new THREE.FogExp2(new THREE.Color(0/255, 5/255, 10/255).getHex(), 0.1);
        
        
        
        
        const geometry = new THREE.PlaneGeometry( 2, 2 );
        const material= new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 0,
                },
                cameraWaterSurfacePos:{
                    value: new THREE.Vector3()
                },
                contactWater:{
                    value: false
                }
            },
            vertexShader: `\
                
                ${THREE.ShaderChunk.common}
                ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            
                uniform float uTime;
                
                varying vec2 vUv;
                varying vec3 vPos;
                
                void main() {
                    vUv = uv;
                   
                    
                    vec3 pos = position;
                    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectionPosition = projectionMatrix * viewPosition;
            
                    gl_Position = projectionPosition;
                    vPos = modelPosition.xyz;
                    ${THREE.ShaderChunk.logdepthbuf_vertex}
                }
            `,
            fragmentShader: `\
                ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
                uniform float uTime;
                uniform bool contactWater;
                //uniform sampler2D sphereTexture;
                uniform vec3 cameraWaterSurfacePos;
                
                varying vec2 vUv;
                varying vec3 vPos;
                

                void main() {
                    gl_FragColor = vec4(0.1, 0.15, 0.2, 0.3);
                    if(!contactWater || vPos.y > cameraWaterSurfacePos.y)
                        gl_FragColor.a = 0.;
                ${THREE.ShaderChunk.logdepthbuf_fragment}
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            //blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const mask = new THREE.Mesh( geometry, material );
        //app.add( mask );
        camera.add(mask);

        useFrame(({timestamp}) => {
           
            // mask.position.set(camera.position.x + cameraDir.x * 0.4, camera.position.y, camera.position.z + cameraDir.z * 0.4); 
            // mask.rotation.copy(camera.rotation);  
            mask.position.set(0, 0, -0.2);
            mask.material.uniforms.uTime.value = timestamp / 1000;
            mask.material.uniforms.cameraWaterSurfacePos.value.copy(cameraWaterSurfacePos);
            mask.material.uniforms.contactWater.value = contactWater;
            if(camera.position.y < cameraWaterSurfacePos.y && contactWater){
                if(renderSettings.findRenderSettings(scene))
                    renderSettings.findRenderSettings(scene).fog.density = 0.05;
            }
            else{
                if(renderSettings.findRenderSettings(scene))
                    renderSettings.findRenderSettings(scene).fog.density = 0;
            }
            app.updateMatrixWorld();
        
        });
    }
    //################################################################ bubble ###########################################################
    {
        const particleCount = 40;
        const group=new THREE.Group();
        let info = {
            velocity: [particleCount],
            offset: [particleCount],
        }
        
        const _getGeometry = geometry => {
            //console.log(geometry)
            const geometry2 = new THREE.BufferGeometry();
            ['position', 'normal', 'uv'].forEach(k => {
            geometry2.setAttribute(k, geometry.attributes[k]);
            });
            geometry2.setIndex(geometry.index);
            
            const positions = new Float32Array(particleCount * 3);
            const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
            geometry2.setAttribute('positions', positionsAttribute);

            const color = new Float32Array(particleCount * 3);
            const colorAttribute = new THREE.InstancedBufferAttribute(color, 3);
            geometry2.setAttribute('color', colorAttribute);
            // const quaternions = new Float32Array(particleCount * 4);
            // for (let i = 0; i < particleCount; i++) {
            //   identityQuaternion.toArray(quaternions, i * 4);
            // }
            // const quaternionsAttribute = new THREE.InstancedBufferAttribute(quaternions, 4);
            // geometry2.setAttribute('quaternions', quaternionsAttribute);

            const scales = new Float32Array(particleCount);
            const scalesAttribute = new THREE.InstancedBufferAttribute(scales, 1);
            geometry2.setAttribute('scales', scalesAttribute);

            const opacityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(particleCount), 1);
            opacityAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry2.setAttribute('opacity', opacityAttribute);

            const startTimeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(particleCount), 1);
            startTimeAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry2.setAttribute('startTime', startTimeAttribute);
        
            
            const offset = new Float32Array(particleCount * 2);
            const offsetAttribute = new THREE.InstancedBufferAttribute(offset, 2);
            geometry2.setAttribute('offset', offsetAttribute);
            

            return geometry2;
        };

        const material= new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 0,
                },
                cameraBillboardQuaternion: {
                    value: new THREE.Quaternion(),
                },
                bubbleTexture1: {
                    value: bubbleTexture1,
                },
            },
            vertexShader: `\
                
                ${THREE.ShaderChunk.common}
                ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            
                
                uniform float uTime;
                uniform vec4 cameraBillboardQuaternion;
                
                
                varying vec2 vUv;
                varying vec3 vPos;
                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vOffset;
                

                attribute vec3 positions;
                attribute vec3 color;
                attribute float scales;
                attribute float opacity;
                attribute vec2 offset;
                

                vec3 rotateVecQuat(vec3 position, vec4 q) {
                    vec3 v = position.xyz;
                    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
                }
                void main() {
                    vUv = uv;
                    vPos = position;
                    // vOpacity = opacity;
                    // vColor = color;
                    vOffset = offset;
                    vec3 pos = position;
                    pos = rotateVecQuat(pos, cameraBillboardQuaternion);
                    pos*=scales;
                    pos+=positions;
                    //pos = qtransform(pos, quaternions);
                    //pos.y=cos(uTime/100.);
                    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectionPosition = projectionMatrix * viewPosition;
            
                    gl_Position = projectionPosition;
                    ${THREE.ShaderChunk.logdepthbuf_vertex}
                }
            `,
            fragmentShader: `\
                ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
                uniform float uTime;
                uniform sampler2D bubbleTexture1;
                varying vec2 vUv;
                varying vec3 vPos;
                varying vec3 vColor;
                varying float vOpacity;
                varying vec2 vOffset;

                void main() {
                    vec4 bubble = texture2D(
                                    bubbleTexture1,
                                    vec2(
                                        vUv.x / 6. + vOffset.x,
                                        vUv.y / 5. + vOffset.y
                                    )
                    );
                    gl_FragColor = bubble;
                    gl_FragColor.a *= 0.5;
                ${THREE.ShaderChunk.logdepthbuf_fragment}
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            //blending: 1,

        });
        let mesh = null;
        function addInstancedMesh() {
            const geometry2 = new THREE.PlaneGeometry( .02, .02 );
            const geometry = _getGeometry(geometry2);
            mesh = new THREE.InstancedMesh(geometry, material, particleCount);
            const positionsAttribute = mesh.geometry.getAttribute('positions');
            for (let i = 0; i < particleCount; i++) {
                positionsAttribute.setXYZ(i, localPlayer.position.x + Math.random() * 5, localPlayer.position.y + Math.random() * 5, localPlayer.position.z + Math.random() * 5);
                info.velocity[i] = new THREE.Vector3();
                
            }
            positionsAttribute.needsUpdate = true;
            // group.add(mesh);
            // app.add(group);
            app.add(mesh);
        }
        addInstancedMesh();
            
        const bubblePos = new THREE.Vector3();
        
        const localVector = new THREE.Vector3();
        let maxEmmit = 5;
        let lastEmmitTime = 0;
        useFrame(({timestamp}) => {
            if (mesh && localPlayer.avatar) {
                let currentEmmit = 0;
                //console.log(Math.floor(currentSpeed * 10 + 1))
                const opacityAttribute = mesh.geometry.getAttribute('opacity');
                const offsetAttribute = mesh.geometry.getAttribute('offset');
                const positionsAttribute = mesh.geometry.getAttribute('positions');
                const scalesAttribute = mesh.geometry.getAttribute('scales');
                const startTimeAttribute = mesh.geometry.getAttribute('startTime');
                const colorAttribute = mesh.geometry.getAttribute('color');
                if(timestamp - lastEmmitTime > 100){
                    for (let i = 0; i < Math.floor(currentSpeed * 10 + 1) * 5; i++){
                        bubblePos.set(positionsAttribute.getX(i), positionsAttribute.getY(i), positionsAttribute.getZ(i));
                        if(scalesAttribute.getX(i) > 1.5 || startTimeAttribute.getX(i) > 100 ){
                            
                            if(currentSpeed > 0.1){
                                playerHeadPos.x += (Math.random() - 0.5) * 0.5;
                                playerHeadPos.y + (Math.random() - 0.5) * 0.2;
                                playerHeadPos.z += (Math.random() - 0.5) * 0.5;
                                info.velocity[i].x = -playerDir.x * 0.01;
                                info.velocity[i].y = 0.0025 + Math.random() * 0.0025;
                                info.velocity[i].z = -playerDir.z * 0.01;
                            }
                            else{
                                playerHeadPos.x += -playerDir.x * 0.25;
                                playerHeadPos.z += -playerDir.z * 0.25;
                                playerHeadPos.x += (Math.random() - 0.5) * 0.5;
                                playerHeadPos.z += (Math.random() - 0.5) * 0.5;
                                playerHeadPos.y -= localPlayer.avatar.height * 0.6;
                                playerHeadPos.y += (Math.random()) * 0.2
                                info.velocity[i].x = 0;
                                info.velocity[i].y = 0.0025 + Math.random() * 0.0025;
                                info.velocity[i].z = 0;
                                
                            }
                            positionsAttribute.setXYZ(i, playerHeadPos.x , playerHeadPos.y, playerHeadPos.z);
                            
                            
                            
    
                            info.offset[i] = Math.floor(Math.random() * 29);
                            startTimeAttribute.setX(i, 0);
                            scalesAttribute.setX(i, Math.random());
                            currentEmmit++;
                        }
                        if(currentEmmit > maxEmmit){
                            lastEmmitTime = timestamp;
                            break;
                        }
                        
                    }
                }
                
                for (let i = 0; i < particleCount; i++){
                    if(positionsAttribute.getY(i) >= waterSurfacePos.y - 0.01){
                        info.velocity[i].y = 0;
                    }
                    positionsAttribute.setXYZ(  i, 
                                                positionsAttribute.getX(i)+info.velocity[i].x,
                                                positionsAttribute.getY(i)+info.velocity[i].y,
                                                positionsAttribute.getZ(i)+info.velocity[i].z
                    );
                    
                    startTimeAttribute.setX(i, startTimeAttribute.getX(i) + 1);
                    if(startTimeAttribute.getX(i) % 2 === 0)
                        info.offset[i] += 1;
                    if(info.offset[i] >= 30){
                        info.offset[i] = 0;
                    }
                    offsetAttribute.setXY(i, (5 / 6) - Math.floor(info.offset[i] / 6) * (1. / 6.), Math.floor(info.offset[i] % 5) * 0.2);
                    if(scalesAttribute.getX(i) > 0)
                        scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.01);
                    if(startTimeAttribute.getX(i) > 150 || positionsAttribute.getY(i) > waterSurfacePos.y){
                        scalesAttribute.setX(i, 0);
                    }
                }
                
                

                
                
                mesh.instanceMatrix.needsUpdate = true;
                positionsAttribute.needsUpdate = true;
                opacityAttribute.needsUpdate = true;
                scalesAttribute.needsUpdate = true;
                startTimeAttribute.needsUpdate = true;
                offsetAttribute.needsUpdate = true;
                colorAttribute.needsUpdate = true;
                
                
                mesh.material.uniforms.uTime.value=timestamp/1000;
                mesh.material.uniforms.cameraBillboardQuaternion.value.copy(camera.quaternion);
                
                

            }
            app.updateMatrixWorld();
        
        });
    }

    //################################################################ half circle follow player ###########################################################
    {
        const particleCount = 40;
        const group=new THREE.Group();
        let info = {
            velocity: [particleCount],
            offset: [particleCount],
        }
        const identityQuaternion = new THREE.Quaternion();
        const _getGeometry = geometry => {
            //console.log(geometry)
            const geometry2 = new THREE.BufferGeometry();
            ['position', 'normal', 'uv'].forEach(k => {
            geometry2.setAttribute(k, geometry.attributes[k]);
            });
            geometry2.setIndex(geometry.index);
            
            const positions = new Float32Array(particleCount * 3);
            const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
            geometry2.setAttribute('positions', positionsAttribute);

            const color = new Float32Array(particleCount * 3);
            const colorAttribute = new THREE.InstancedBufferAttribute(color, 3);
            geometry2.setAttribute('color', colorAttribute);
            const quaternions = new Float32Array(particleCount * 4);
            for (let i = 0; i < particleCount; i++) {
              identityQuaternion.toArray(quaternions, i * 4);
            }
            const quaternionsAttribute = new THREE.InstancedBufferAttribute(quaternions, 4);
            geometry2.setAttribute('quaternions', quaternionsAttribute);

            const scales = new Float32Array(particleCount);
            const scalesAttribute = new THREE.InstancedBufferAttribute(scales, 1);
            geometry2.setAttribute('scales', scalesAttribute);

            const opacityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(particleCount), 1);
            opacityAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry2.setAttribute('opacity', opacityAttribute);

            const startTimeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(particleCount), 1);
            startTimeAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry2.setAttribute('startTime', startTimeAttribute);
        
            const playerRotation = new Float32Array(particleCount);
            const playerRotAttribute = new THREE.InstancedBufferAttribute(playerRotation, 1);
            geometry2.setAttribute('playerRotation', playerRotAttribute);

            const textureRotation = new Float32Array(particleCount);
            const textureRotAttribute = new THREE.InstancedBufferAttribute(textureRotation, 1);
            geometry2.setAttribute('textureRotation', textureRotAttribute);

            const brokenAttribute = new THREE.InstancedBufferAttribute(new Float32Array(particleCount), 1);
            brokenAttribute.setUsage(THREE.DynamicDrawUsage);
            geometry2.setAttribute('broken', brokenAttribute);

            const speed = new Float32Array(particleCount);
            const speedAttribute = new THREE.InstancedBufferAttribute(speed, 1);
            geometry2.setAttribute('speed', speedAttribute);
            

            return geometry2;
        };

        const material= new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 0,
                },
                cameraBillboardQuaternion: {
                    value: new THREE.Quaternion(),
                },
                noiseCircleTexture: {
                    value: noiseCircleTexture,
                },
                noiseTexture: {
                    value: noiseTexture,
                },
                noiseTexture2: {
                    value: noiseTexture2,
                },
            },
            vertexShader: `\
                
                ${THREE.ShaderChunk.common}
                ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
            
                
                uniform float uTime;
                uniform vec4 cameraBillboardQuaternion;
                
                
                varying vec2 vUv;
                varying vec3 vPos;
                varying float vBroken;
                varying vec3 vColor;
                varying float vOpacity;
                varying float vTextureRotation;
                varying float vSpeed;
                

                attribute vec3 positions;
                attribute vec4 quaternions;
                attribute float broken;
                attribute vec3 color;
                attribute float scales;
                attribute float opacity;
                attribute float playerRotation;
                attribute float textureRotation;
                attribute float speed;
                
                

                vec3 rotateVecQuat(vec3 position, vec4 q) {
                    vec3 v = position.xyz;
                    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
                }
                void main() {
                    mat3 rotY = mat3(cos(playerRotation), 0.0, -sin(playerRotation), 0.0, 1.0, 0.0, sin(playerRotation), 0.0, cos(playerRotation));
                    vUv = uv;
                    vPos = position;
                    vBroken=broken;
                    vSpeed=speed;
                    vTextureRotation = textureRotation;
                    // vOpacity = opacity;
                    // vColor = color;
                    vec3 pos = position;
                    pos = rotateVecQuat(pos, quaternions);
                    pos*= -rotY;
                    pos*=scales;
                    pos+=positions;
                    //pos = qtransform(pos, quaternions);
                    //pos.y=cos(uTime/100.);
                    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectionPosition = projectionMatrix * viewPosition;
            
                    gl_Position = projectionPosition;
                    ${THREE.ShaderChunk.logdepthbuf_vertex}
                }
            `,
            fragmentShader: `\
                ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
                uniform float uTime;
                uniform sampler2D noiseCircleTexture;
                uniform sampler2D noiseTexture;
                uniform sampler2D noiseTexture2;
                
                varying vec2 vUv;
                varying vec3 vPos;
                varying float vBroken;
                varying vec3 vColor;
                varying float vOpacity;
                varying float vTextureRotation;
                varying float vSpeed;

                #define PI 3.1415926

                void main() {
                    float mid = 0.5;
                    vec2 rotated = vec2(cos(vTextureRotation*PI) * (vUv.x - mid) - sin(vTextureRotation*PI) * (vUv.y - mid) + mid,
                                cos(vTextureRotation*PI) * (vUv.y - mid) + sin(vTextureRotation*PI) * (vUv.x - mid) + mid);
                    vec2 rotated2 = vec2(cos(vTextureRotation*PI) * (vUv.x - mid) * 1.09 - sin(vTextureRotation*PI) * (vUv.y - mid) * 1.09 + mid,
                                cos(vTextureRotation*PI) * (vUv.y - mid) * 1.09 + sin(vTextureRotation*PI) * (vUv.x - mid) * 1.09 + mid);
                    vec4 circle = texture2D(
                                    noiseCircleTexture,
                                    rotated
                    );
                    vec4 circle2 = texture2D(
                                    noiseCircleTexture,
                                    rotated2
                    );
                    vec4 noiseMap = texture2D(
                                    noiseTexture,
                                    rotated
                    );
                    vec4 noiseMap2 = texture2D(
                                    noiseTexture2,
                                    rotated
                    );

                    gl_FragColor = (circle + circle2) * noiseMap;
                    gl_FragColor += circle2;
                    if(gl_FragColor.r < 0.5){
                        discard;
                    }
                    else{
                        gl_FragColor.rgb = vec3(0.4, 0.4, 0.4);
                    }
                    
                    
                    if(vSpeed > 0.1){
                        if(vUv.y < 0.35){
                            gl_FragColor.a = 0.;
                        }
                    }
                   
                    float broken = abs( sin( 1.0 - vBroken) ) - noiseMap2.g;
                    if ( broken < 0.0001 ) discard;

                ${THREE.ShaderChunk.logdepthbuf_fragment}
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            //blending: 1,

        });
        let mesh = null;
        let quaternion = new THREE.Quaternion();
        function addInstancedMesh() {
            const geometry2 = new THREE.PlaneGeometry( .25 * 2, .3 * 2 );
            const geometry = _getGeometry(geometry2);
            mesh = new THREE.InstancedMesh(geometry, material, particleCount);
            
            const quaternionsAttribute = mesh.geometry.getAttribute('quaternions');
            for (let i = 0; i < particleCount; i++) {
                quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
                quaternionsAttribute.setXYZW(i,quaternion.x,quaternion.y,quaternion.z,quaternion.w);
            }
            quaternionsAttribute.needsUpdate = true;
            
            app.add(mesh);
        }
        addInstancedMesh();
            
        const localVector = new THREE.Vector3();
        let lastEmmitTime = 0;
        useFrame(({timestamp}) => {
            if (mesh && localPlayer.avatar) {
                //const currentSpeed = localVector.set(localPlayer.avatar.velocity.x, 0, localPlayer.avatar.velocity.z).length();
                const opacityAttribute = mesh.geometry.getAttribute('opacity');
                const positionsAttribute = mesh.geometry.getAttribute('positions');
                const scalesAttribute = mesh.geometry.getAttribute('scales');
                const startTimeAttribute = mesh.geometry.getAttribute('startTime');
                const colorAttribute = mesh.geometry.getAttribute('color');
                const playerRotationAttribute = mesh.geometry.getAttribute('playerRotation');
                const textureRotationAttribute = mesh.geometry.getAttribute('textureRotation');
                const brokenAttribute = mesh.geometry.getAttribute('broken');
                const speedAttribute = mesh.geometry.getAttribute('speed');
                if(timestamp - lastEmmitTime > 300 * Math.pow((0.8-currentSpeed), 1) && contactWater && localPlayer.hasAction('swim')){
                    if(!wholeBelowwWater && currentSpeed > 0.){
                        for (let i = 0; i < particleCount; i++){
                            if(scalesAttribute.getX(i) <= 0){
                                if(localPlayer.rotation.x!==0){
                                    playerRotationAttribute.setX(i, Math.PI + localPlayer.rotation.y);
                                }
                                else{
                                    playerRotationAttribute.setX(i, -localPlayer.rotation.y);
                                }
                                textureRotationAttribute.setX(i, Math.random() * 2);
                                positionsAttribute.setXYZ(i, localPlayer.position.x + playerDir.x * 0.3, waterSurfacePos.y + 0.001, localPlayer.position.z + playerDir.z * 0.3);
                                scalesAttribute.setX(i, 1);
                                //scalesAttribute.setX(i, 1.5 + Math.random() * 0.1);
                                brokenAttribute.setX(i, 0);
                                speedAttribute.setX(i, currentSpeed);
                                lastEmmitTime = timestamp;
                                break;
                            }
                            
                        }
                    }
                    
                }
                for (let i = 0; i < particleCount; i++){
                    if(scalesAttribute.getX(i) < 1.5){
                        scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.1);
                    }
                    else{
                        scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.05 );
                    }
                    //if(scalesAttribute.getX(i) >= 0.1)
                    //     scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.03);
                    
                    // if(scalesAttribute.getX(i) > 3){
                    //     scalesAttribute.setX(i, 0);
                    // }
                    if(brokenAttribute.getX(i)< 1.0 && scalesAttribute.getX(i) > 1.5)
                        brokenAttribute.setX(i, brokenAttribute.getX(i) + 0.02);
                    if(brokenAttribute.getX(i) >= 1.0){
                        scalesAttribute.setX(i, 0);
                    }
                }
                mesh.instanceMatrix.needsUpdate = true;
                positionsAttribute.needsUpdate = true;
                opacityAttribute.needsUpdate = true;
                scalesAttribute.needsUpdate = true;
                startTimeAttribute.needsUpdate = true;
                colorAttribute.needsUpdate = true;
                playerRotationAttribute.needsUpdate = true;
                textureRotationAttribute.needsUpdate = true;
                brokenAttribute.needsUpdate = true;
                speedAttribute.needsUpdate = true;
                mesh.material.uniforms.uTime.value=timestamp/1000;
                mesh.material.uniforms.cameraBillboardQuaternion.value.copy(camera.quaternion);
                
                

            }
            app.updateMatrixWorld();
        
        });
    }
   
  app.setComponent('renderPriority', 'low');
  
  return app;
};


