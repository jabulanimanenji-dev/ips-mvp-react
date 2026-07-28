import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect
} from 'react';

import { useLocalStorage } from '../hooks/useLocalStorage';
import { hasAdminPermission } from '../../shared/adminPermissions';


const AuthContext = createContext();



export function AuthProvider({ children }) {


  const [
    user,
    setUser,
    removeUser
  ] = useLocalStorage(
    'ips-user',
    null
  );


  const [
    admin,
    setAdmin,
    removeAdmin
  ] = useLocalStorage(
    'ips-admin-session',
    null
  );


  const [
    writer,
    setWriter,
    removeWriter
  ] = useLocalStorage(
    'ips-writer-session',
    null
  );



  const [loading, setLoading] =
    useState(true);



  useEffect(() => {

    // Allow stored sessions to load
    // before protected routes check auth

    const timer =
      setTimeout(() => {
        setLoading(false);
      }, 100);


    return () =>
      clearTimeout(timer);


  }, []);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    fetch('/api/admin/me', { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Administrator session expired.');
        if (!cancelled) {
          setAdmin(previous => ({
            ...data.admin,
            id: data.admin?.adminId || data.admin?.id || previous?.id
          }));
        }
      })
      .catch(() => {
        if (!cancelled) removeAdmin();
      });
    return () => { cancelled = true; };
  }, [admin?.id, removeAdmin, setAdmin]);






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

          setUser({
            ...data.client,
            token: data.token
          });


          return {
            success:true
          };

        }



        return {
          success:false,
          error:
            data.message ||
            'Invalid credentials'
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

  const signupClient =
    useCallback(
      async (
        name,
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/clients',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    full_name:name,
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){

            setUser({
              ...data.client,
              token: data.token
            });


            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.error ||
              data.message ||
              'Signup failed'
          };



        } catch(err){


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
            error:
              data.message ||
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


            setWriter({

              ...data.writer,

              token:
                data.token

            });



            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.message ||
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




export const useAuth =
  () =>
    useContext(AuthContext);
