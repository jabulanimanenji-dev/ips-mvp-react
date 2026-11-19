import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect
} from 'react';

import { hasAdminPermission } from '../../shared/adminPermissions';

const AuthContext=createContext();

// No account identity or signed session token is trusted from browser storage.
// Rehydrate the *current* account from a validated HttpOnly server session.
export function AuthProvider({children}){
  const [user,setUser]=useState(null);
  const [writer,setWriter]=useState(null);
  const [admin,setAdmin]=useState(null);
  const [loading,setLoading]=useState(true);
  const removeUser=useCallback(()=>setUser(null),[]);
  const removeWriter=useCallback(()=>setWriter(null),[]);
  const removeAdmin=useCallback(()=>setAdmin(null),[]);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const limit=setTimeout(()=>controller.abort(),9000);
    const get=async(path,key)=>{
      try{
        const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!response.ok)return null;
        const data=await response.json();
        return data.success?data[key]||null:null;
      }catch{return null;}
    };
    // A single signed cookie represents at most one role; all others must
    // remain absent. A 401/403/timeout never opens a protected workspace.
    Promise.all([
      get('/api/client/me','client'),
      get('/api/writer/me','writer'),
      get('/api/admin/me','admin')
    ]).then(([client,specialist,operator])=>{
      if(!active)return;
      if(client)setUser(client);
      else if(specialist)setWriter(specialist);
      else if(operator)setAdmin({...operator,id:operator.adminId||operator.id});
    }).finally(()=>{
      clearTimeout(limit);
      if(active)setLoading(false);
    });
    try{
      for(const key of ['ips-user','ips-writer-session','ips-admin-session'])
        window.localStorage.removeItem(key);
    }catch{}
    return ()=>{active=false;clearTimeout(limit);controller.abort();};
  },[]);

  // ==========================
  // CLIENT LOGIN
  // ==========================

  const loginClient = useCallback(
    async (email, password) => {

      try {

        const response =
          await fetch(
            '/api/client/login',
            {
              method:'POST',

              headers:{
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  email,
                  password
                })
            }
          );



        const data =
          await response.json();



        if (data.success) {

          setUser(data.client);


          return {
            success:true
          };

        }



        return {
          success:false,
          verification_required:Boolean(data.verification_required),
          error:data.message||data.error||'Invalid credentials'
        };


      } catch(err) {


        return {
          success:false,
          error:
            'Server error'
        };

      }


    },
    [setUser]
  );







  // ==========================
  // CLIENT SIGNUP
  // ==========================

  // Student account registration never creates a signed-in session. Proof of
  // mailbox control is mandatory before account access is permitted.
  const signupClient=useCallback(async(username,email,password)=>{
    try{
      const response=await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username,email,password})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)return {success:false,error:data.error||'Account registration is unavailable.',
        verification_required:Boolean(data.verification_required)};
      return {success:true,verification_required:Boolean(data.verification_required)};
    }catch{return {success:false,error:'Secure account registration is currently unavailable.'};}
  },[]);

  const verifyClientEmail=useCallback(async(email,code)=>{
    try{
      const response=await fetch('/api/client/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,code})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)return {success:false,error:data.error||'Verification failed.'};
      setUser(data.client);
      return {success:true};
    }catch{return {success:false,error:'Email verification is not available.'};}
  },[setUser]);

  const resendClientVerification=useCallback(async(email)=>{
    try{
      const response=await fetch('/api/client/resend-verification',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email})});
      const data=await response.json().catch(()=>({}));
      return response.ok?{success:true,message:data.message}:{success:false,error:data.error||'Unable to resend.'};
    }catch{return {success:false,error:'Unable to request a new verification code.'};}
  },[]);

  // ==========================
  // ADMIN LOGIN
  // ==========================

  const loginAdmin =
    useCallback(
      async (
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/admin/login',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){


            setAdmin({
              ...(data.admin || {}),
              id: data.admin?.id || data.admin?.adminId || email,
              email: data.admin?.email || email,
              role: data.admin?.role || data.role
            });



            return {
              success:true
            };

          }



          return {
            success:false,
            verification_required:Boolean(data.verification_required),
            error:data.message||data.error||'Invalid credentials'
          };



        } catch(err){


          return {
            success:false,
            error:
              'Server error'
          };


        }


      },
      [setAdmin]
    );







  // ==========================
  // WRITER LOGIN
  // ==========================


  const loginWriter =
    useCallback(
      async (
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/writer/login',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){


            setWriter(data.writer);



            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.message || data.error ||
              'Invalid credentials'
          };



        } catch(err){


          return {
            success:false,
            error:
              'Server error'
          };


        }


      },
      [setWriter]
    );








  const logout =
    useCallback(() => {

      fetch('/api/logout', { method: 'POST' }).catch(() => {});

      removeUser();

      removeAdmin();

      removeWriter();


    }, [
      removeUser,
      removeAdmin,
      removeWriter
    ]);

  const updateClientProfile =
    useCallback(
      async (updates) => {
        if (!user?.client_id) {
          return { success: false, error: 'No client session is available.' };
        }

        try {
          const response = await fetch(`/api/clients/${user.client_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            return { success: false, error: data.error || 'Profile update failed.' };
          }
          setUser(previous => ({
            ...previous,
            ...data.client,
            token: previous?.token
          }));
          return { success: true, client: data.client };
        } catch {
          return { success: false, error: 'The server could not update your profile.' };
        }
      },
      [setUser, user?.client_id]
    );

  const changeAdminPassword =
    useCallback(
      async (currentPassword, newPassword) => {
        try {
          const response = await fetch('/api/admin/change-password', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.success) {
            return { success: false, error: data.error || 'The administrator password could not be changed.' };
          }
          setAdmin(previous => ({
            ...data.admin,
            id: data.admin?.adminId || data.admin?.id || previous?.id
          }));
          return { success: true };
        } catch {
          return { success: false, error: 'The server could not change the administrator password.' };
        }
      },
      [setAdmin]
    );







  return (

    <AuthContext.Provider

      value={{

        user,

        admin,

        writer,

        loading,

        loginClient,

        signupClient,
        verifyClientEmail,
        resendClientVerification,

        loginAdmin,

        loginWriter,

        updateClientProfile,

        changeAdminPassword,

        logout,

        hasAdminPermission:
          permission =>
            hasAdminPermission(admin, permission)

      }}

    >

      {children}

    </AuthContext.Provider>

  );

}

const PREVIEW_CLIENT = {
  _id: 'preview-client-001',
  client_id: 'preview-client-001',
  full_name: 'Preview Client',
  email: 'client.preview@ips.local',
  token: 'preview-client-token'
};

const PREVIEW_WRITER = {
  _id: 'preview-provider-001',
  writer_id: 'preview-provider-001',
  full_name: 'Preview Service Provider',
  email: 'provider.preview@ips.local',
  applicationStatus: 'approved',
  status: 'Active',
  token: 'preview-provider-token'
};

const PREVIEW_ADMIN = {
  _id: 'preview-admin-001',
  id: 'preview-admin-001',
  adminId: 'preview-admin-001',
  name: 'Preview Super Admin',
  full_name: 'Preview Super Admin',
  email: 'admin.preview@ips.local',
  role: 'superadmin',
  isSuperAdmin: true,
  permissions: ['*'],
  mustChangePassword: false,
  token: 'preview-admin-token'
};

export function PreviewAuthProvider({ children, pageId = 'public.home' }) {
  const portal = pageId.split('.')[0];
  const previewResult = async () => ({ success: false, preview: true, error: 'Actions are disabled in preview mode.' });
  return (
    <AuthContext.Provider value={{
      user: portal === 'client' ? PREVIEW_CLIENT : null,
      writer: portal === 'writer' && pageId !== 'writer.login' ? PREVIEW_WRITER : null,
      admin: portal === 'admin' && pageId !== 'admin.login' ? PREVIEW_ADMIN : null,
      loading: false,
      loginClient: previewResult,
      signupClient: previewResult,
      verifyClientEmail: previewResult,
      resendClientVerification: previewResult,
      loginAdmin: previewResult,
      loginWriter: previewResult,
      updateClientProfile: previewResult,
      changeAdminPassword: previewResult,
      logout: () => {},
      hasAdminPermission: () => true
    }}>
      {children}
    </AuthContext.Provider>
  );
}




export const useAuth =
  () =>
    useContext(AuthContext);
